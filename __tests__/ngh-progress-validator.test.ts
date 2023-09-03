import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {expect, test,it,describe,beforeAll} from '@jest/globals'
import { ValidationResult, validateProgress } from  '../src/ngh-progress-validator'
import glob from 'glob'

function readTestFiles( workspaceRoot: string, mdGlob: string) {
  return glob.sync(mdGlob, {
      cwd: workspaceRoot,
      silent: true,
      nodir: true
    }
  )
}

const testGlob = '**/*.md'
const ip = path.join(__dirname, '..', '__tests__', 'fixtures', 'case_01')
const testFiles = readTestFiles(ip, testGlob).map(tf => [tf, !(tf.split('/').pop() as string).startsWith('invalid')])
// const testFiles = readTestFiles(ip, testGlob).map(tf => [tf, !tf.startsWith('invalid')])
describe('test case 01', () => {
  console.log(testFiles)
  it.each(testFiles)('%s is valid: %s', async (tf, valid) => {
    const results = await validateProgress(ip, tf)
    expect(results).toContainEqual({
      filePath: tf,
      valid: valid,
    })
  })
})
