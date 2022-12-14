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
exports.validateProgress = void 0;
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const core = __importStar(require("@actions/core"));
const file_reader_1 = require("./file-reader");
const glob_1 = require("glob");
const yaml = require('js-yaml');
const readdir = (0, util_1.promisify)(fs.readdir);
function findStatus(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const subdirs = dir.split(path.sep);
        for (let i = subdirs.length; i > 0; i--) {
            const statusFileLocation = (dir.startsWith('/') ? '/' : '') + path.join(...subdirs.slice(0, i + 1), '_status.yml');
            core.debug(`try to find statuses in ${statusFileLocation}`);
            try {
                if (!fs.existsSync(statusFileLocation)) {
                    core.debug(`${statusFileLocation} not found`);
                    continue;
                }
                const statusFile = fs.readFileSync(statusFileLocation);
                const statusYaml = yaml.load(statusFile);
                const statuses = Object.values(statusYaml).map(sv => Object.keys(sv)[0]);
                core.debug('found statuses in ' + statusFileLocation);
                core.debug(statuses.join(' - '));
                return statuses;
            }
            catch (nofound) {
                core.error(`exception during reading ${statusFileLocation}: ${nofound}`);
            }
        }
        throw 'No status found for ' + dir;
    });
}
const stat = (0, util_1.promisify)(fs.stat);
function getFiles(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const subdirs = yield readdir(dir);
        const files = yield Promise.all(subdirs.map((subdir) => __awaiter(this, void 0, void 0, function* () {
            const res = path.resolve(dir, subdir);
            return (yield stat(res)).isDirectory() ? getFiles(res) : [res];
        })));
        return files.reduce((a, f) => a.concat(f), []);
    });
}
const validateProgress = (workspaceRoot, mdGlob) => __awaiter(void 0, void 0, void 0, function* () {
    //TODO: improve this implementation - e.g. use the glob patterns from the yaml.schemas settings
    core.info('following filepaths found');
    const filePaths = yield new Promise((c, e) => {
        (0, glob_1.glob)(mdGlob, {
            cwd: workspaceRoot,
            silent: true,
            nodir: true
        }, 
        // tslint:disable-next-line
        (err, files) => {
            if (err) {
                e(err);
            }
            c(files);
        });
    });
    core.info(filePaths.join(' - '));
    // const wsFiles = await getFiles(workspaceRoot)
    // core.debug(wsFiles.join(' | '))
    return yield Promise.all(filePaths.map((filePath) => __awaiter(void 0, void 0, void 0, function* () {
        core.info('check statuses in ' + filePath);
        const failures = [];
        const contentR = /\(\((\/){0,1}(when|until)\s*?(\S*?)\)\)/gs;
        const hintR = /^\#.*?\(\((when|until) (.*?)\)\).*$/gm;
        let mdFile = fs.readFileSync(path.join(workspaceRoot, filePath)).toString('utf-8');
        const yamlDocument = yield (0, file_reader_1.getYaml)(path.join(workspaceRoot, filePath));
        let hintM, contentM;
        try {
            const allowedStatuses = yield findStatus(path.join(workspaceRoot, path.dirname(filePath)));
            hintM = mdFile.matchAll(hintR);
            // Check and remove hints
            for (const match of hintM) {
                mdFile = mdFile.replace(match[0], '');
                const verb = match[1];
                let state = match[2];
                core.debug(`${filePath}: found hint ${verb} ${state}`);
                state = state.replace(/^\!/, '');
                for (const ss of state.split(/[,|]/)) {
                    if (!allowedStatuses.includes(ss)) {
                        core.warning(`${filePath}: invalid hint state ${ss}`);
                        failures.push(`invalid hint state ${ss}`);
                    }
                }
            }
            contentM = mdFile.matchAll(contentR);
            const whenStack = [];
            for (const match of contentM) {
                const verb = match[2];
                let state = match[3];
                const ending = !!match[1];
                // console.log(filePath, verb, state, ending)
                core.debug(`${filePath}: found content ${verb} ${state}`);
                if (!ending) {
                    whenStack.push(verb);
                    state = state.replace(/^\!/, '');
                    for (const ss of state.split(/[,|]/)) {
                        if (!allowedStatuses.includes(ss)) {
                            core.warning(`${filePath}: invalid content state ${ss}`);
                            failures.push(`invalid content state ${ss}`);
                        }
                    }
                }
                else {
                    const currentVerb = whenStack.pop();
                    if (currentVerb === undefined) {
                        core.warning(`${filePath}: unmatched verb ending (${verb})`);
                        failures.push(`unmatched verb ending (${verb})`);
                    }
                    if (currentVerb !== verb) {
                        core.warning(`${filePath}: mismatching verbs (${currentVerb} vs ${verb})`);
                        failures.push(`mismatching verbs (${currentVerb} vs ${verb})`);
                    }
                }
            }
            if (whenStack.length > 0) {
                core.warning(`${filePath}: unmatched verb begin (${whenStack.join(',')})`);
                failures.push(`unmatched verb begin (${whenStack.join(',')})`);
            }
            if (yamlDocument.when) {
                const state = yamlDocument.when.replace(/^!/, '');
                for (const ss of state.split(/[,|]/)) {
                    if (!allowedStatuses.includes(ss)) {
                        core.warning(`${filePath}: invalid when state ${ss}`);
                        failures.push(`invalid when state ${ss}`);
                    }
                }
            }
            if (yamlDocument.until) {
                const state = yamlDocument.until.replace(/^!/, '');
                for (const ss of state.split(/[,|]/)) {
                    if (!allowedStatuses.includes(ss)) {
                        core.warning(`${filePath}: invalid until state ${ss}`);
                        failures.push(`invalid until state ${ss}`);
                    }
                }
            }
        }
        catch (e) {
            if ((contentM !== undefined && !(contentM === null || contentM === void 0 ? void 0 : contentM.next().done)) || (hintM !== undefined && !(hintM === null || hintM === void 0 ? void 0 : hintM.next().done))) {
                core.warning(filePath + ': has statuses, but no valid status.yml found!');
                return { filePath, valid: false };
            }
        }
        if (failures.length === 0) {
            core.debug(`${filePath} was ok`);
        }
        return { filePath, valid: failures.length === 0 };
    })));
});
exports.validateProgress = validateProgress;
