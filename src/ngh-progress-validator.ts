import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as core from '@actions/core'
import {getYaml} from './file-reader'
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
			let statuses
			if (statusYaml.map != undefined) {
				// It is a list of dicts!
				core.debug('old status format in ' + statusFileLocation)
				statuses = Object.values(statusYaml).map(sv => Object.keys(sv as {})[0])
			} else {
				statuses = Object.keys(statusYaml)
			}
			core.debug('found statuses in ' + statusFileLocation)
			core.debug(statuses.join(' - '))
			return statuses
		} catch (nofound) {
			core.error(`exception during reading ${statusFileLocation}: ${nofound}`)
		}
	}
	throw 'No status found for ' + dir
}

function checkStateValidity(allowedStatuses: string[], state: string) {
  // Check if state splitted by one of these (comma, and, or) is in allowedStatuses
  const splitted = state.split(/,|\s+and\s+|\s+or\s+/)
  for (const ss of splitted) {
	if (!allowedStatuses.includes(ss)) {
	  return false
	}
  }
  return true
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
			const failures = []
			const contentR = /\(\((\/){0,1}(when|until)\s*(.*?)\)\)/gs
			const hintR = /^\#.*?\(\((when|until)\s+(.*?)\)\).*$/gm
			const buttonR = /\[(\s*)\](\S+)/gm
			let mdFile = fs.readFileSync(path.join(workspaceRoot, filePath)).toString('utf-8')
			const yamlDocument = await getYaml(path.join(workspaceRoot, filePath))
			let hintM, contentM, buttonM

			try {
				const allowedStatuses = await findStatus(path.join(workspaceRoot, path.dirname(filePath)))

				buttonM = mdFile.matchAll(buttonR)

				for (const match of buttonM) {
					const state = match[2]
					core.debug(`${filePath}: found button ${state}`)
					if (!checkStateValidity(allowedStatuses, state)) {
						core.warning(`${filePath}: invalid button state ${state}`)
						failures.push(`invalid button state ${state}`)
					}
					const whitespaces = match[1]
					if (whitespaces !== ' ') {
						core.warning(`${filePath}: invalid button format ${match[0]}`)
						failures.push(`invalid button format ${match[0]}`)
					}
				}

				hintM = mdFile.matchAll(hintR)
				// Check and remove hints
				for (const hintMatch of hintM) {
					mdFile = mdFile.replace(hintMatch[0], '')

					const hintVerbs = hintMatch[0].matchAll(contentR)
					const usedVerbs: string[] = []

					for (const match of hintVerbs) {
						const verb = match[2]
						if (usedVerbs.includes(verb)) {
							core.warning(`${filePath}: multiple verbs in one hint ${verb}`)
							failures.push(`multpile verbs in one hint ${verb}`)
						}
						usedVerbs.push(verb)
						let state = match[3]
						core.debug(`${filePath}: found hint ${verb} ${state}`)
						state = state.replace(/^\!/, '')
						for (const ss of state.split(/[,|]/)) {
							if (!checkStateValidity(allowedStatuses, state)) {
								core.warning(`${filePath}: invalid hint state ${ss}`)
								failures.push(`invalid hint state ${ss}`)
							}
						}
					}
				}

				contentM = mdFile.matchAll(contentR)
				const whenStack = []
				for (const match of contentM) {
					const verb = match[2]
					let state = match[3]
					const ending = !!match[1]
					core.debug(`${filePath}: found content ${verb} ${state} ${ending}`)
					if (!ending) {
						whenStack.push(verb)
						state = state.replace(/^\!/, '')
						if (!checkStateValidity(allowedStatuses, state)) {
							core.warning(`${filePath}: invalid content state ${state}`)
							failures.push(`invalid content state ${state}`)
						}
					} else {
						const currentVerb = whenStack.pop()
						if (currentVerb === undefined) {
							core.warning(`${filePath}: unmatched verb ending (${verb})`)
							failures.push(`unmatched verb ending (${verb})`)
						}
						if (currentVerb !== verb) {
							core.warning(`${filePath}: mismatching verbs (${currentVerb} vs ${verb})`)
							failures.push(`mismatching verbs (${currentVerb} vs ${verb})`)
						}
					}
				}
				if (whenStack.length > 0) {
					core.warning(`${filePath}: unmatched verb begin (${whenStack.join(',')})`)
					failures.push(`unmatched verb begin (${whenStack.join(',')})`)
				}
				if (yamlDocument.when) {
					const state = yamlDocument.when.replace(/^!/, '')
					for (const ss of state.split(/[,|]/)) {
						if (!checkStateValidity(allowedStatuses, state)) {
							core.warning(`${filePath}: invalid when state ${ss}`)
							failures.push(`invalid when state ${ss}`)
						}
					}
				}
				if (yamlDocument.until) {
					const state = yamlDocument.until.replace(/^!/, '')
					for (const ss of state.split(/[,|]/)) {
						if (!checkStateValidity(allowedStatuses, state)) {
							core.warning(`${filePath}: invalid until state ${ss}`)
							failures.push(`invalid until state ${ss}`)
						}
					}
				}
			} catch (e) {
				if ((contentM !== undefined && !contentM?.next().done) || (hintM !== undefined && !hintM?.next().done)) {
					core.warning(filePath + ': has statuses, but no valid status.yml found!')
					return { filePath, valid: false }
				}
			}
			if (failures.length === 0) {
				core.debug(`${filePath} was ok`)
			}
			return { filePath, valid: failures.length === 0 }
		})
	)
}