'use strict';
var fs = require('fs');
var path = require('path');
var async = require('async');
var utils = require('../lib/utils.js');
var logger = require('../lib/logger.js');
var self = require('../package.json');
var npm = utils.getNpm();
var npmGlobalDir, ifGlobalInstall = true;
/*应该被全局安装的模块*/
var modulesShouldBeInstalled = ['fis3', 'fis-parser-less', 'fis3-parser-html-uri', 
                                'fis3-parser-get-conf', 'fis3-hook-module', 
                                'fis-parser-babel-6.x', 'pm2', 'bower', 
                                'nodemon', 'node-inspector', 'http-server'];
var modulesNeedInstalling = [];
var series = [];

logger.info(`${self.name} 模块安装成功, 将为您自动安装 ${modulesShouldBeInstalled} 等模块.`);

/*加载npm*/
series.push(function (cb) {
  npm.load({loaded: false, 'global': true}, cb);
});

/*获取全局路径*/
series.push(function (cb) {
  npm.commands.root(function(err, data){
    if (err) {
      npmGlobalDir = npm.config.get('globalconfig');
      npmGlobalDir = path.join(npmGlobalDir, '..');
    }else{
      npmGlobalDir = data;
    }
    logger.info(`npm的全局安装路径为: ${npmGlobalDir}`);
    cb();
  });
});

/*检测应当被全局安装的模块是否全局安装*/
modulesShouldBeInstalled.forEach(function(moduleName){
  series.push(function(cb){
    isModuleInstalledGlobally(moduleName, cb);
  });
});

/*安装依赖模块*/
series.push(function(cb){
  if (modulesNeedInstalling.length <= 0) {
    cb();
    return;
  }
  logger.info(`开始安装 ${modulesNeedInstalling} 模块.`);
  npm.commands.install(modulesNeedInstalling, function (er, data) {
    if (er) {
      throw er;
    }
    cb();
  });
  npm.on('log', function (message) {
    logger.info(message);
  });
});

series.push(function (cb) {
  logger.info(`${self.name} 模块安装流程完成.`);
});

/*执行整个步骤*/
async.series(series);

function isModuleInstalledGlobally(moduleName, cb) {
  var modulePath = path.join(npmGlobalDir, `${moduleName}`);
  if (!ifGlobalInstall) {
    cb();
    return;
  }

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