"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const ngh_progress_validator_1 = require("./ngh-progress-validator");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const workspaceRoot = process.env['GITHUB_WORKSPACE'] || process.cwd();
            const mdGlob = core.getInput('mdGlob') || '**/*.md';
            core.info('check ngh links');
            core.info(workspaceRoot);
            core.info(mdGlob);
            const validationResults = yield (0, ngh_progress_validator_1.validateProgress)(workspaceRoot, mdGlob);
            const invalidResults = validationResults
                .filter(res => !res.valid)
                .map(res => res.filePath);
            const invalidFiles = invalidResults.length > 0 ? invalidResults.join(',') : '';
            core.setOutput('invalidFiles', invalidFiles);
            if (invalidResults.length > 0) {
                core.warning(`Invalid Files: ${invalidFiles}`);
                core.setFailed('NGH progress validation failed on one or more YAML files.');
            }
            else {
                core.info(`✅ NGH progress validation completed successfully`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
