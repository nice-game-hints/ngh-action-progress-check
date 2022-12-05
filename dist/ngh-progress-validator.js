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
const glob_1 = require("glob");
const yaml = require('js-yaml');
const readdir = (0, util_1.promisify)(fs.readdir);
function findStatus(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const subdirs = dir.split(path.sep);
        for (let i = subdirs.length; i > 0; i--) {
            const statusFileLocation = path.join(...subdirs.slice(0, i + 1), '_status.yml');
            try {
                const statusFile = yield fs.promises.readFile(statusFileLocation);
                const statusYaml = yaml.load(statusFile);
                const statuses = Object.values(statusYaml).map(sv => Object.keys(sv)[0]);
                core.debug('found statuses in ' + statusFileLocation);
                core.debug(statuses.join(' - '));
                return statuses;
            }
            catch (nofound) {
            }
        }
        throw 'No status found for ' + dir;
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
    return yield Promise.all(filePaths.map((filePath) => __awaiter(void 0, void 0, void 0, function* () {
        core.info('check statuses in ' + filePath);
        const allowedStatuses = yield findStatus(path.join(workspaceRoot, path.dirname(filePath)));
        const r = /\(\((when|until) (.*?)\)\)(.*?)\(\(\/(when|until)\)\)/gs;
        const mdFile = fs.readFileSync(path.join(workspaceRoot, filePath)).toString('utf-8');
        const m = mdFile.matchAll(r);
        for (const match of m) {
            const verb = match[1];
            const state = match[2];
            core.debug(` found: ${verb} ${state}`);
            if (!allowedStatuses.includes(state)) {
                core.warning(`invalid state ${state} in ${filePath}`);
                return { filePath, valid: false };
            }
        }
        core.debug(` was ok`);
        return { filePath, valid: true };
    })));
});
exports.validateProgress = validateProgress;
