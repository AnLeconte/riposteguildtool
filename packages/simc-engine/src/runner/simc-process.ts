import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { OUTPUT_PATH_PLACEHOLDER } from '../profile-builder/quick-sim.js';

export interface SimcProcessCallbacks {
  /** Called periodically with a progress percentage (0–100). */
  onProgress: (pct: number) => void;
  /** Called when SimC exits with code 0. Receives the path to the json2 output file. */
  onComplete: (jsonPath: string) => void;
  /** Called when SimC exits with a non-zero code or encounters a spawn error. */
  onError: (error: string) => void;
}

/**
 * Generate a unique filename suffix using a timestamp + random number.
 */
function uniqueSuffix(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Derive the SimC executable name based on the current platform.
 * On Windows the binary is `simc.exe`; on other platforms it is `simc`.
 */
function defaultSimcExecutable(): string {
  return process.platform === 'win32' ? 'simc.exe' : 'simc';
}

/**
 * Spawn a SimulationCraft process to run the provided .simc content.
 *
 * Steps:
 *  1. Write `simcContent` to a temporary `.simc` file (after replacing the
 *     `{{OUTPUT_PATH}}` placeholder with a temp json path).
 *  2. Spawn the `simc` executable with the temp file as argument.
 *  3. Parse stdout for progress lines (SimC outputs lines like `Generating` or
 *     percentage indicators such as `12.3%`).
 *  4. On exit code 0 call `onComplete` with the json output path.
 *  5. On non-zero exit or spawn error call `onError`.
 *  6. Clean up the temp `.simc` file after the process ends (the json output
 *     is left for the caller to consume and delete).
 *
 * @param simcContent  Full .simc file content (may contain `{{OUTPUT_PATH}}`).
 * @param callbacks    Progress/completion/error callbacks.
 * @param simcPath     Optional path to the simc executable. Defaults to `simc`
 *                     (or `simc.exe` on Windows) resolved via PATH.
 * @returns            An object with a `cancel()` function that kills the process.
 */
export function runSimc(
  simcContent: string,
  callbacks: SimcProcessCallbacks,
  simcPath?: string,
): { cancel: () => void } {
  const { onProgress, onComplete, onError } = callbacks;

  const suffix = uniqueSuffix();
  const simcFilePath = join(tmpdir(), `wow-simc-${suffix}.simc`);
  const jsonOutputPath = join(tmpdir(), `wow-simc-${suffix}.json`);

  // Replace the output path placeholder with the actual temp json path.
  // On Windows we need forward slashes or escaped backslashes for SimC.
  const normalizedJsonPath = jsonOutputPath.replace(/\\/g, '/');
  const resolvedContent = simcContent.replace(
    OUTPUT_PATH_PLACEHOLDER,
    normalizedJsonPath,
  );

  const executable = simcPath ?? defaultSimcExecutable();

  // We store the process handle so cancel() can kill it.
  // eslint-disable-next-line prefer-const
  let proc: ReturnType<typeof spawn> | null = null;
  let cancelled = false;
  let settled = false;

  /** Cleanup temp .simc file (not the json output). */
  const cleanupSimcFile = (): void => {
    unlink(simcFilePath).catch(() => {
      // Ignore cleanup errors — the file may already be gone.
    });
  };

  /** Settle once and call the appropriate callback. */
  const settle = (fn: () => void): void => {
    if (settled) return;
    settled = true;
    cleanupSimcFile();
    fn();
  };

  // Write the .simc file, then spawn SimC.
  writeFile(simcFilePath, resolvedContent, 'utf8')
    .then(() => {
      if (cancelled) {
        cleanupSimcFile();
        return;
      }

      try {
        proc = spawn(executable, [simcFilePath], {
          // Inherit env so that PATH is available for locating the binary.
          env: process.env,
          // Pipe stdout/stderr so we can parse progress.
          stdio: ['ignore', 'pipe', 'pipe'],
          // On Windows, use shell to resolve .exe paths reliably
          shell: process.platform === 'win32',
        });
      } catch (spawnErr: any) {
        settle(() => onError(`Failed to spawn SimC: ${spawnErr.message}`));
        return;
      }

      let stdoutBuffer = '';
      let stderrBuffer = '';

      // --- Progress parsing ---
      // SimC prints lines during simulation. We look for percentage patterns
      // like:
      //   "Generating... 12.3%"
      //   "  12.3%"
      //   "12%"
      // We take the last percentage seen on each line.
      const PCT_REGEX = /(\d+(?:\.\d+)?)%/;

      proc.stdout?.setEncoding('utf8');
      proc.stdout?.on('data', (chunk: string) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split(/\r?\n/);
        // Keep the last (possibly incomplete) line in the buffer.
        stdoutBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const match = PCT_REGEX.exec(line);
          if (match) {
            const pct = Math.min(100, Math.max(0, parseFloat(match[1])));
            onProgress(pct);
          }
        }
      });

      proc.stderr?.setEncoding('utf8');
      proc.stderr?.on('data', (chunk: string) => {
        stderrBuffer += chunk;
      });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        const message =
          err.code === 'ENOENT'
            ? `SimC executable not found: "${executable}". Make sure SimulationCraft is installed and available in PATH.`
            : `Failed to spawn SimC: ${err.message}`;

        settle(() => onError(message));
      });

      proc.on('close', (code: number | null) => {
        if (cancelled) {
          settle(() => onError('Simulation cancelled'));
          return;
        }

        if (code === 0) {
          settle(() => onComplete(jsonOutputPath));
        } else {
          const detail = stderrBuffer.trim() || stdoutBuffer.trim();
          const message = detail
            ? `SimC exited with code ${code}:\n${detail}`
            : `SimC exited with code ${code}`;
          settle(() => onError(message));
        }
      });
    })
    .catch((err: unknown) => {
      const message =
        err instanceof Error
          ? `Failed to write temp simc file: ${err.message}`
          : 'Failed to write temp simc file';
      settle(() => onError(message));
    });

  return {
    cancel: () => {
      cancelled = true;
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
        // On Windows, SIGTERM is not always honoured — follow up with SIGKILL.
        if (process.platform === 'win32') {
          setTimeout(() => {
            try {
              proc?.kill('SIGKILL');
            } catch {
              // Process may have already exited.
            }
          }, 500);
        }
      }
    },
  };
}
