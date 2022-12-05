interface ValidationError {}

export class InvalidFileError extends Error implements ValidationError {
  filePath: string
  innerError: Error | object

  constructor(filePath: string, innerError: Error | object) {
    super()
    this.innerError = innerError
    this.filePath = filePath
  }
}

export class InvalidSchemaError extends Error implements ValidationError {
  reason: string

  constructor(reason: string) {
    super()
    this.reason = reason
  }
}

export class InvalidJsonError extends Error implements ValidationError {
  reason: string
  enrichedError?: string

  constructor(reason: string, enrichedError?: string) {
    super()
    this.reason = reason
    this.enrichedError = enrichedError
  }
}