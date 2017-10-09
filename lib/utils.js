const fs   = require('fs');
const path = require('path');
let npm;

exports.getGlobalNpm = getGlobalNpm;

/**
 * 获取全局 npm 引用
 * @author 康永胜
 * @date   2017-10-09T14:38:28+0800
 * @return {Object}                 [全局 npm 引用]
 */
function getGlobalNpm(){
  var npmPath = 'npm';

  /*如果npm引用已经存在，则直接返回*/
  if (npm) {
    return npm;
  }

  try{
    npm = require(npmPath);
  }catch(e){
    switch(process.platform){
      case 'win32':
        npmPath = getNpmPath(process.env.PATH.split(';'), 'npm.cmd');
        break;
      case 'darwin':
      case 'freebsd':
      case 'linux':
      case 'sunos':
      default:
        npmPath = getNpmPath(process.env.PATH.split(':'), 'npm');
        break;
    }

    npm = require(npmPath);
  }

  return npm;
}

/**
 * 从环境变量 PATH 指定的路径中寻找 npm 命令
 * @author 康永胜
 * @date   2017-10-09T14:43:52+0800
 * @param  {Array}                 pathArr     [PATH所包含的路径数据]
 * @param  {String}                npmFileName [npm 命令的文件名称]
 * @return {String}                            [全局npm所在的路径]
 */
function getNpmPath(pathArr, npmFileName){
  var npmPath = '', lstat;

  pathArr = pathArr || [];

  for (var i = 0, len = pathArr.length; i < len; i++) {

    npmPath = path.join(pathArr[i], npmFileName);

    if (!fs.existsSync(npmPath)) {
      continue;
    }

    lstat = fs.lstatSync(npmPath);

    if (lstat.isFile()) {
      return path.join(pathArr[i], 'node_modules', 'npm');
    }else if (lstat.isSymbolicLink()){
      return path.join(getRealPathFromLink(npmPath), '..', '..');
    }else if (lstat.isDirectory()) {
      return npmPath;
    }  

  }

  return '';
}

/**
 * 获取软链接所指向的真实文件的地址
 * @author 康永胜
 * @date   2017-10-09T14:48:27+0800
 * @param  {String}                 filepath [软链接路径]
 * @return {String}                          [真实文件路径]
 */
function getRealPathFromLink(filepath){
  var target = fs.readlinkSync(filepath);

  if (!path.isAbsolute(target)) {
    target = path.join(filepath, '..', target);
  }

  var lstat = fs.lstatSync(target);

  if (lstat.isSymbolicLink()) {
    return getRealPathFromLink(target);
  }

  return target
}