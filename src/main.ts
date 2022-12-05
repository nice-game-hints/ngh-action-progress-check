import * as core from '@actions/core'
import { validateProgress } from './ngh-progress-validator'
import {wait} from './wait'

async function run(): Promise<void> {
  try {
    const workspaceRoot = process.env['GITHUB_WORKSPACE'] || process.cwd()
    const mdGlob = core.getInput('mdGlob') || '**/*.md'

    core.info('check ngh links')
    core.info(workspaceRoot)
    core.info(mdGlob)
    const validationResults = await validateProgress(workspaceRoot, mdGlob)
    const invalidResults = validationResults
      .filter(res => !res.valid)
      .map(res => res.filePath)
    const invalidFiles =
      invalidResults.length > 0 ? invalidResults.join(',') : ''
    core.setOutput('invalidFiles', invalidFiles)

    if (invalidResults.length > 0) {
      core.warning(`Invalid Files: ${invalidFiles}`)
      core.setFailed(
        'NGH progress validation failed on one or more YAML files.'
      )
    } else {
      core.info(`✅ NGH progress validation completed successfully`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
