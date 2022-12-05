import * as fs from 'fs'
import {InvalidFileError} from './errors'
// tslint:disable-next-line
const yaml = require('js-yaml')

// tslint:disable-next-line
export const getYaml = async (filePath: string): Promise<any> => {
  try {
    let fileContents = await fs.promises.readFile(filePath, {encoding: 'utf-8'})
    const reg = /^---\s*[\n\r]+(.*)[\n\r]+---\s*/s.exec(fileContents)
    if (reg) {
      fileContents = reg[1]
    } else {
      fileContents = ''
    }
    return yaml.load(fileContents)
  } catch (ex) {
    throw new InvalidFileError(filePath, ex as Error)
  }
}

// tslint:disable-next-line
export const getJson = async (filePath: string): Promise<any> => {
  try {
    const fileContents = await fs.promises.readFile(filePath, {
      encoding: 'utf-8'
    })
    const json = JSON.parse(fileContents)
    return json
  } catch (ex) {
    throw new InvalidFileError(filePath, ex as Error)
  }
}