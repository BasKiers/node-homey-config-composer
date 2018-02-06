'use strict';

const path = require('path');
const fse = require('fs-extra');
const yaml = require('js-yaml');

module.exports = class configParser {

	constructor(rootPath, configPath) {
		rootPath = typeof rootPath === 'string' ? rootPath : process.cwd();
		configPath = path.join(rootPath, typeof configPath === 'string' ? configPath : 'config');

		if (!fse.existsSync(rootPath)) throw new Error(`${rootPath} does not exist`);
		if (!fse.lstatSync(rootPath).isDirectory()) throw new Error(`${rootPath} is not a directory`);
		if (!fse.existsSync(configPath)) throw new Error(`${configPath} does not exist`);
		if (!fse.lstatSync(configPath).isDirectory()) throw new Error(`${configPath} is not a directory`);

		this.root = rootPath;
		this.configDir = configPath;
		this.configDirFiles = fse.readdirSync(configPath);
		this.appConfigPath = path.join(rootPath, 'app.json');
		this.appLocalesPath = path.join(rootPath, 'locales');
		this.appConfig = require(this.appConfigPath);
		this.hasScript = this.configDirFiles.indexOf('script.js') !== -1;
		this.scriptPath = path.join(this.configDir, 'script.js');
	}

	compose() {
		console.log('Composing folders into app.json');

		const locales = this.readDirFiles('locales', { toObject: true });
		const config = this.readDirFiles('config', { toObject: true });
		const signals = this.readDirFiles('signals', { toObject: true });
		const drivers = this.readDirFiles('drivers');
		const triggers = this.readDirFiles('flow/triggers');
		const conditions = this.readDirFiles('flow/conditions');
		const actions = this.readDirFiles('flow/actions');
		const screensavers = this.readDirFiles('screensavers');
		const speech = this.readDirFiles('speech');

		// Set applocales to config object;
		if ((locales && Object.keys(locales).length) || this.hasScript) {
			let appLocales = this.readDirFiles(path.relative(this.configDir, this.appLocalesPath), {
					toObject: true,
					suppressLogs: true
				}) || {};
			const flattenValues = (obj) => {
				return Object.values(obj)
					.reduce((result, val) => result.concat(typeof val === 'object' ? flattenValues(val) : val), []);
			};
			const traverse = (obj, appLocale, path = []) => {
				for (const key in obj) {
					if (typeof obj[key] === 'string') {
						if (typeof appLocale[key] === 'string') {
							if (appLocale[key].slice(-1) !== '\u0000') {
								console.log(`Skipping manually edited locale at ${path.concat(key).join('.')}`);
								continue;
							}
						} else if (typeof appLocale[key] === 'object' && flattenValues(appLocale[key]).some(val => val.slice(-1) !== '\u0000')) {
							console.log(`Skipping manually edited locale at ${path.concat(key).join('.')}. Old value is an object with manually edited entries.`);
							continue;
						}
						appLocale[key] = `${obj[key]}\u0000`;
					} else if (typeof obj[key] === 'object') {
						if (typeof appLocale[key] === 'string' && appLocale[key].slice(-1) !== '\u0000') {
							console.log(`Skipping all keys after ${path.concat(key).join('.')} due to manual entry`);
							continue;
						}
						appLocale[key] = typeof appLocale[key] === 'object' ? appLocale[key] || {} : {};
						traverse(obj[key], appLocale[key], path.concat(key));
					}
				}
			};
			const deleteGeneratedValues = (obj) => {
				for (const key in obj) {
					if (typeof obj[key] === 'string') {
						if (obj[key].slice(-1) === '\u0000') delete obj[key];
					} else if (typeof obj[key] === 'object') {
						deleteGeneratedValues(obj[key]);
						if (obj[key] && !Object.keys(obj[key]).length) delete obj[key];
					}
				}
			};
			deleteGeneratedValues(appLocales);
			appLocales = appLocales || {};
			if (locales && Object.keys(locales).length) {
				traverse(locales, appLocales);
			}
			this.appConfig.locales = appLocales;
		}

		if (config) {
			Object.assign(this.appConfig, config);
		}
		if (signals) {
			this.appConfig.signals = signals;
		}
		this.appConfig.flow = this.appConfig.flow || {};
		if (drivers) {
			this.appConfig.drivers = drivers;
		}
		if (triggers) {
			this.appConfig.flow.triggers = triggers;
		}
		if (conditions) {
			this.appConfig.flow.conditions = conditions;
		}
		if (actions) {
			this.appConfig.flow.actions = actions;
		}
		if (screensavers) {
			this.appConfig.screensavers = screensavers;
		}
		if (speech) {
			this.appConfig.speech = speech;
		}

		if (this.hasScript) {
			const scripts = [].concat(require(this.scriptPath));
			scripts.forEach(script => {
				if (typeof script === 'function') {
					const appConfig = script(this.appConfig, this.root);
					if (appConfig) {
						this.appConfig = appConfig;
					}
				}
			});
		}

		const writeLocales = this.appConfig.locales;
		delete this.appConfig.locales;
		fse.writeJsonSync(this.appConfigPath, this.appConfig);
		if (writeLocales) {
			Object.keys(writeLocales).forEach(localeId => {
				fse.writeJsonSync(path.join(this.appLocalesPath, `${localeId}.json`), writeLocales[localeId]);
			});
		}
		console.log('done...');
	}

	readDirFiles(configFolder, opts = {}) {
		const { suppressLogs, toObject } = opts;
		const configPath = path.join(this.configDir, configFolder);
		if (!fse.existsSync(configPath)) {
			const { dir, name } = path.parse(configFolder);
			if (!dir && name) {
				const configFile = this.configDirFiles.find(fileName => path.parse(fileName).name === name);
				if (configFile) {
					if (!suppressLogs) {
						console.log('Adding', configFile);
					}
					const { ext } = path.parse(configFile);
					if (ext === '.yaml' || ext === '.yml') {
						return yaml.safeLoad(fse.readFileSync(path.join(this.configDir, configFile), 'utf8'));
					}
					return require(path.join(this.configDir, configFile));
				}
			}

			return undefined;
		}
		if (!suppressLogs) {
			console.log('Composing', configFolder);
		}
		const files = fse.readdirSync(configPath);
		return files.reduce((result, file) => {
			const filePath = path.join(configPath, file);
			const stat = fse.lstatSync(filePath);
			const { ext, name: baseName } = path.parse(file);
			if (stat.isDirectory()) {
				const childFiles = this.readDirFiles(
					path.join(configFolder, file),
					Object.assign({}, opts, { suppressLogs: true })
				);
				if (toObject) {
					result[file] = childFiles;
					return result;
				}
				return result.concat(childFiles);
			} else if (stat.isFile() && baseName !== file) {
				const obj = ext === '.yaml' || ext === '.yml' ? yaml.safeLoad(fse.readFileSync(filePath, 'utf8')) : require(filePath);
				if (obj && obj.constructor.name === 'Object') {
					if (toObject) {
						result[baseName] = obj;
						return result;
					}
					return result.concat(obj);
				} else if (obj && obj.constructor.name === 'Array') {
					if (toObject) {
						result[baseName] = obj;
						return result;
					}
					return result.concat(obj.filter((elem, index) => {
						if (!elem || elem.constructor.name !== 'Object') {
							console.warn(`[Warning] ${filePath} contains element at index ${index} which is not an Object:${elem}`);
							return false;
						}
						return true;
					}, []));
				} else {
					console.warn(`[Warning] ${filePath} contains value that is not an Object:${obj}`);
					return result;
				}
			}
			console.warn(`[Info] Skipping ${filePath} since it is not a .json or .js file`);
			return result
		}, toObject ? {} : []);
	}
};
