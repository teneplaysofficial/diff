// @ts-check
import * as core from '@actions/core'
import ansi from 'ansilory'
import { ExecaError, execa } from 'execa'
import figlet from 'figlet'
import git from 'use-git'
import pkg from '../package.json' with { type: 'json' }

try {
  const bannerLines = figlet
    .textSync(pkg.displayName, { font: 'Slant' })
    .split('\n')

  for (let i = bannerLines.length - 1; i >= 0; i--) {
    if (bannerLines[i].trim()) {
      bannerLines[i] =
        ansi.cyan.bold.apply(bannerLines[i].trimEnd()) +
        ' ' +
        ansi.gray.dim.apply(`v${pkg.version}`)
      break
    }
  }

  console.log(
    bannerLines.map((l) => (l.trim() ? ansi.cyan.bold.apply(l) : l)).join('\n'),
  )

  // types

  /**
   * @typedef {Object} CommandResult
   * @property {string} command
   * @property {boolean} ok
   * @property {string} stdout
   * @property {string} stderr
   * @property {number | null} exitCode
   * @property {NodeJS.Signals | null} signal
   * @property {string} [message]
   */

  // inputs
  const commands = core.getMultilineInput('run', { required: true })
  const failMessage =
    core.getInput('fail-message') ||
    'Generated or formatted files are out of date.'
  const failOnCommandError = core.getBooleanInput('fail-on-command-error')
  const failOnDiff = core.getBooleanInput('fail-on-diff')

  /**
   * @param {unknown} value
   */
  function normalizeOutput(value) {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.join('\n')
    if (value instanceof Uint8Array) return Buffer.from(value).toString()
    return ''
  }

  /**
   * @param {string} command
   * @param {import('execa').Options} [options]
   * @returns {Promise<CommandResult>}
   */
  async function runCommand(command, options = {}) {
    try {
      const result = await execa(command, { shell: true, ...options })

      return {
        command,
        ok: true,
        stdout: normalizeOutput(result.stdout),
        stderr: normalizeOutput(result.stderr),
        exitCode: null,
        signal: null,
      }
    } catch (error) {
      if (error instanceof ExecaError) {
        return {
          command,
          ok: false,
          exitCode: error.exitCode ?? null,
          signal: error.signal ?? null,
          message: error.message,
          stdout: normalizeOutput(error.stdout),
          stderr: normalizeOutput(error.stderr),
        }
      }

      return {
        command,
        ok: false,
        exitCode: null,
        signal: null,
        message: String(error),
        stdout: '',
        stderr: '',
      }
    }
  }

  /**
   * @param {string[]} cmds
   * @returns {Promise<CommandResult[]>}
   */
  async function runCommands(cmds) {
    /** @type {CommandResult[]} */
    const results = []
    for (const command of cmds) {
      results.push(await runCommand(command))
    }
    return results
  }

  core.startGroup('Running commands')
  const results = await runCommands(commands)
  core.endGroup()

  const failures = results.filter((r) => !r.ok)
  core.setOutput('command_failures', String(failures.length))

  if (failures.length > 0) {
    core.startGroup('Command failures')

    for (const f of failures) {
      core.warning(`Command failed: ${f.command}`)
      if (f.exitCode !== null) core.warning(`Exit code: ${f.exitCode}`)
      if (f.stderr) core.error(f.stderr)
    }

    core.endGroup()

    if (failOnCommandError) {
      throw new Error(
        `Command execution failed (${failures.length} failures):\n` +
          failures
            .map(
              (f) => `- ${f.command} (exit code: ${f.exitCode}): ${f.message}`,
            )
            .join('\n'),
      )
    }
  }

  const diffExists = await git.hasDiff()
  core.setOutput('has_diff', String(diffExists))

  if (!diffExists) {
    core.notice('Working tree is clean')

    await core.summary
      .addHeading('Diff Sentinel')
      .addRaw('No uncommitted changes detected\n')
      .write()

    process.exit(0)
  }

  const changedFiles = await git.getChangedFiles()
  core.setOutput('changed_files', changedFiles.join('\n'))
  core.setOutput('diff_count', String(changedFiles.length))

  core.startGroup('Changed files')
  changedFiles.forEach((f) => {
    console.log(`- ${f}`)
  })
  core.endGroup()

  core.startGroup('Diff')
  await git.diff(changedFiles)
  core.endGroup()

  await core.summary
    .addHeading('Diff Sentinel Failed', 1)
    .addRaw(`${failMessage}\n`)
    .addHeading('Changed files', 3)
    .addList(changedFiles)
    .addHeading('How to fix', 3)
    .addCodeBlock(commands.join('\n'), 'bash')
    .write()

  if (failOnDiff) throw new Error(failMessage)
} catch (error) {
  core.setFailed(
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  )
}
