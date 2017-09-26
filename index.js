var fis = module.exports =  require('fis3');

/* swa 命令封装*/
fis.require.prefixes.unshift('swa');
fis.cli.name = 'swa';
fis.cli.info = require('./package.json');
fis.cli.version = function(){
  var info = fis.cli.info;
  console.log('version: ', info.name, ' ', info.version);
};