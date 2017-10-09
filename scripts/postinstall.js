'use strict';
const fs     = require('fs');
const path   = require('path');
const async  = require('async');
const utils  = require('../lib/utils.js');
const logger = require('../lib/logger.js');
const self   = require('../package.json');
const npm    = utils.getGlobalNpm();
const modulesNeedInstalling = [];
const promises = [];

/*应该被全局安装的模块*/
const modulesShouldBeInstalled = ['fis3', 'fis-parser-less', 'fis3-parser-html-uri', 
  'fis3-parser-get-conf', 'fis3-hook-module', 'fis-parser-babel-6.x', 'pm2', 'bower', 
  'nodemon', 'node-inspector', 'http-server'];
let   npmGlobalDir;

logger.info(`${self.name} 模块安装成功, 将为您自动安装 ${modulesShouldBeInstalled} 等模块.`);

/*加载npm*/
promises.push(new Promise((reslove, reject) => {
  npm.load({loaded: false, 'global': true}, reslove);
}));

/*获取全局路径*/
promises.push(new Promise((reslove, reject) => {
  npm.commands.root(function(err, data){
    if (err) {
      npmGlobalDir = npm.config.get('globalconfig');
      npmGlobalDir = path.join(npmGlobalDir, '..');
    }else{
      npmGlobalDir = data;
    }
    logger.info(`npm的全局安装路径为: ${npmGlobalDir}`);
    reslove();
  });
}));

/*检测应当被全局安装的模块是否全局安装*/
modulesShouldBeInstalled.forEach(function(moduleName){
  promises.push(new Promise((reslove, reject) => {
    isModuleInstalledGlobally(moduleName, reslove);
  }));
});

/*安装依赖模块*/
promises.push(new Promise((reslove, reject) => {
  if (modulesNeedInstalling.length <= 0) {
    reslove();
    return;
  }
  logger.info(`开始安装 ${modulesNeedInstalling} 模块.`);
  npm.commands.install(modulesNeedInstalling, function (er, data) {
    if (er) {
      throw er;
    }
    reslove();
  });
  npm.on('log', function (message) {
    logger.info(message);
  });
}));

Promise.all(promises)
.then(() => {
  logger.info(`${self.name} 模块安装流程完成.`);
})
.catch( e => {
  logger.error(`${self.name} 模块安装流程出现错误: `, e);
});

function isModuleInstalledGlobally(moduleName, cb) {
  var modulePath = path.join(npmGlobalDir, `${moduleName}`);

  logger.info('');
  logger.info(`--------------------------------------------------`);
  logger.info(`正在检测 ${moduleName} 模块是否安装: ${modulePath}`);

  fs.exists(modulePath, function(exists){
    if (exists) {
      logger.info(`${moduleName} 模块已经全局安装.`);
    }else{
      logger.info(`${moduleName} 模块尚未全局安装, 将为您自动安装.`);
      modulesNeedInstalling.push(moduleName);
    }
    logger.info(`--------------------------------------------------`);
    cb();
  });
}