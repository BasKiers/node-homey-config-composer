'use strict';

const path = require('path');
const fse = require('fs-extra');

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
		this.appConfigPath = path.join(rootPath, 'app.json');
		this.appConfig = require(this.appConfigPath);
	}

	compose() {
		console.log('Composing folders into app.json');

		const drivers = this.readDirFiles('drivers');
		const triggers = this.readDirFiles('flow/triggers');
		const conditions = this.readDirFiles('flow/conditions');
		const actions = this.readDirFiles('flow/actions');
		const screensavers = this.readDirFiles('screensavers');
		const speech = this.readDirFiles('speech');

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

		fse.writeJsonSync(this.appConfigPath, this.appConfig);
		console.log('done...');
	}

	readDirFiles(configFolder, supressLogs) {
		const configPath = path.join(this.configDir, configFolder);
		if (!fse.existsSync(configPath)) {
			return undefined;
		}
		if (!supressLogs) {
			console.log('Composing', configFolder);
		}
		const files = fse.readdirSync(configPath);
		return files.reduce((objectList, file) => {
			const filePath = path.join(configPath, file);
			const stat = fse.lstatSync(filePath);
			if (stat.isDirectory()) {
				return objectList.concat(this.readDirFiles(path.join(configFolder, file), true));
			} else if (stat.isFile() && (file.slice(-3) === '.js' || file.slice(-5) === '.json')) {
				const obj = require(filePath);
				if (obj && obj.constructor.name === 'Object') {
					return objectList.concat(obj);
				} else if (obj && obj.constructor.name === 'Array') {
					return objectList.concat(obj.filter((elem, index) => {
						if(!elem || elem.constructor.name !== 'Object'){
							console.warn(`[Warning] ${filePath} contains element at index ${index} which is not an Object:${elem}`);
							return false;
						}
						return true;
					}, []));
				} else {
					console.warn(`[Warning] ${filePath} contains value that is not an Object:${obj}`)
					return objectList;
				}
			} else {
				console.warn(`[Info] Skipping ${filePath} since it is not a .json or .js file`);
			}
		}, []);
	}
};
