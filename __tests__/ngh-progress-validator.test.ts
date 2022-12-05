import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {expect, test} from '@jest/globals'
import { validateProgress } from  '../src/ngh-progress-validator'
import { describe } from 'node:test'

test('valid case', async () => {
  const ip = path.join(__dirname, '..', '__tests__', 'fixtures', 'case_01')
  const results = await validateProgress(ip, '**/*.md')
  expect(results).toContainEqual({
    filePath: 'index.md',
    valid: true
  })
})

test('invalid case', async () => {
  const ip = path.join(__dirname, '..', '__tests__', 'fixtures', 'case_01')
  const results = await validateProgress(ip, '**/*.md')
  expect(results).toContainEqual({
    filePath: 'invalid-content.md',
    valid: false
  })
  expect(results).toContainEqual({
    filePath: 'submd/more/index.md',
    valid: false
  })
  expect(results).toContainEqual({
    filePath: 'submd/index.md',
    valid: true
  })
  expect(results).toContainEqual({
    filePath: 'mismatch.md',
    valid: false
  })
})

test('real case', async () => {
  const ip = path.join(__dirname, '..', '__tests__', 'fixtures', 'tm_case')
  const results = await validateProgress(ip, '**/*.md')
  expect(results).toContainEqual({
    filePath: 'part-1/enter-arcade.md',
    valid: true
  })
  expect(results).toContainEqual({
    filePath: 'index.md',
    valid: true
  })
})