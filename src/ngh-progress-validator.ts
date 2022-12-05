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
		const statusFileLocation = (dir.startsWith('/') ? '/' : '') + path.join(...subdirs.slice(0, i+1), '_status.yml')
		core.debug(`try to find statuses in ${statusFileLocation}`)
		try {
			if (!fs.existsSync(statusFileLocation)) {
				core.debug(`${statusFileLocation} not found`)
				continue
			}
			const statusFile = fs.readFileSync(statusFileLocation)
			const statusYaml = yaml.load(statusFile)
			const statuses = Object.values(statusYaml).map(sv => Object.keys(sv as {})[0])
			core.debug('found statuses in ' + statusFileLocation)
			core.debug(statuses.join(' - '))
			return statuses
		} catch (nofound) {
			core.error(`exception during reading ${statusFileLocation}: ${nofound}`)
		}
	}
	throw 'No status found for ' + dir
}

const stat = promisify(fs.stat);
async function getFiles(dir: string) : Promise<string[]> {
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    return (await stat(res)).isDirectory() ? getFiles(res) : [res];
  }));
  return files.reduce((a, f) => a.concat(f), []);
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

	// const wsFiles = await getFiles(workspaceRoot)
	// core.debug(wsFiles.join(' | '))

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
					const verb2 = match[4]
					const state = match[2]
					core.debug(`${filePath}: found ${verb} ${state} with closing ${verb2}`)
					if (verb !== verb2) {
						core.warning(`${filePath}: mismatching verbs on state ${state} (${verb} vs ${verb2})`)
						return { filePath, valid: false }
					}
					if (!allowedStatuses.includes(state)) {
						core.warning(`${filePath}: invalid state ${state}`)
						return { filePath, valid: false }
					}
				}
			} catch {
				if (!m.next().done) {
					core.warning(filePath + ': has statuses, but no valid status.yml found!')
					return { filePath, valid: false }
				}
			}
			core.debug(`${filePath} was ok`)
			return { filePath, valid: true }
		})
	)
}