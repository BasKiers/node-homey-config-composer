'use strict';

const path = require('path');
const commander = require('commander');
const Composer = require('./lib/composer');

const pjson = require(path.join(__dirname, 'package.json'));

commander
	.version(pjson.version);

commander
	.command('compose [configPath] [projectPath]')
	.description('composes files in the config folder into the app.json file')
	.action((configPath, projectPath) => new Composer(projectPath, configPath).compose());

commander.parse(process.argv);
