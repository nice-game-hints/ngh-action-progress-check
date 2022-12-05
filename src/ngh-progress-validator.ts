import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as core from '@actions/core'
import {glob} from 'glob'

export interface ValidationResult {
  filePath: string
  valid: boolean
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
			return { filePath, valid: true }
		})
	)
}