import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as core from '@actions/core'
import {glob} from 'glob'
import { connected } from 'process'
const yaml = require('js-yaml')

const readdir = promisify(fs.readdir);

export interface ValidationResult {
  filePath: string
  valid: boolean
}

async function findStatus(dir: string): Promise<string[]> {
	const subdirs = dir.split(path.sep)

	for (let i = subdirs.length; i > 0; i--) {
		const statusFileLocation = path.join(...subdirs.slice(0, i+1), '_status.yml')
		try {
			const statusFile = await fs.promises.readFile(statusFileLocation)
			const statusYaml = yaml.load(statusFile)
			const statuses = Object.values(statusYaml).map(sv => Object.keys(sv as {})[0])
			core.debug('found statuses in ' + statusFileLocation)
			core.debug(statuses.join(' - '))
			return statuses
		} catch (nofound) {
		}
	}
	throw 'No status found for ' + dir
}

export const validateProgress = async (
	workspaceRoot: string,
	mdGlob: string
): Promise<ValidationResult[]> => {
	//TODO: improve this implementation - e.g. use the glob patterns from the yaml.schemas settings
	core.info('following filepaths found')
	const filePaths = await new Promise<string[]>((c, e) => {
		glob(
			mdGlob,
			{
				cwd: workspaceRoot,
				silent: true,
				nodir: true
			},
			// tslint:disable-next-line
			(err: any, files: string[] | PromiseLike<string[]>) => {
				if (err) {
					e(err)
				}
				c(files)
			}
		)
	})
	core.info(filePaths.join(' - '))

	return await Promise.all(
		filePaths.map(async filePath => {
			core.info('check statuses in ' + filePath)
			const r = /\(\((when|until) (.*?)\)\)(.*?)\(\(\/(when|until)\)\)/gs
			const mdFile = fs.readFileSync(path.join(workspaceRoot, filePath)).toString('utf-8')
			const m = mdFile.matchAll(r)
			try {
				const allowedStatuses = await findStatus(path.join(workspaceRoot, path.dirname(filePath)))
				for (const match of m) {
					const verb = match[1]
					const state = match[2]
					core.debug(` found: ${verb} ${state}`)
					if (!allowedStatuses.includes(state)) {
						core.warning(`invalid state ${state} in ${filePath}`)
						return { filePath, valid: false }
					}
				}
			} catch {
				if (!m.next().done) {
					core.warning(' has statuses, but no valid statuses found!')
					return { filePath, valid: false }
				}
			}
			core.debug(` was ok`)
			return { filePath, valid: true }
		})
	)
}