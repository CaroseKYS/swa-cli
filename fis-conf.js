'use strict';
const path   = require('path');
const fs     = require('fs');
const exec   = require('child_process').exec;
const mkdirp = require('mkdirp');
const open   = require('opn');
const utils  = require('swa-utils');

const oConfFilePath = path.join(process.cwd(), 'swa-conf.js');
let   oConf = {};

try{
  oConf = require(oConfFilePath);
}catch(e){}

const cContext     = oConf['context-and-multi-apps'] || {};
let   sContext     = '';
const sRealContext = utils.getJsonProp(cContext, 'self.context-path') || '';
const sTitle       = path.basename(process.cwd()) + '  |  ' + process.cwd();
const options      = fis.get('options');
const oExOptions   = fis.get('ex-options') || {};

/*为发布规则配置做准备*/
fis.get('project.ignore').push('.svn/**');

/*js压缩选项配置*/
fis.config.set('settings.optimizer.uglify-js', {
  mangle: {
    /*压缩时不应当被混淆的关键字*/
    except: ['exports', 'module', 'require', 'define']  
  },
  compress : {
    /*压缩时删除 console语句*/
    drop_console: true
  }
});

/*将需要使用到的插件引入*/
const parserES6     = fis.plugin('babel-6.x');
const parserLess    = fis.plugin('less');
const parserHtmlUri = fis.plugin('html-uri');
const parserGetConf = fis.plugin('get-conf', {
  contextPath: sRealContext,
  ifExcluded: function(propStr){
    return propStr in {};
  }
});

const optimizerHtmlCompress  = fis.plugin('html-compress');
const optimizerUglifyJs      = fis.plugin('uglify-js');
const optimizerCleanCss      = fis.plugin('clean-css');
const optimizerPngCompressor = fis.plugin('png-compressor');
const sprites                = fis.plugin('csssprites');
const sCurrentMedia          = fis.project.currentMedia();/*当前发布所使用的 media 名称*/

/*开发环境下指定的发布目录*/
const sDevDeployPath = options.d || options.dest || utils.getJsonProp(oConf, 'deploy.real-path') || '../swa-deploy';

/*部署目标*/
const aVendorCdnReceivers = []; //公共资源cdn部署
const aBizCdnReceivers    = []; //业务cdn部署
const aWebServerReceivers = []; //web服务器部署

/*nodemon的调试端口*/
fis.set('nodemon.debug.port', utils.getJsonProp(oConf, 'deploy.debug-prot') || 5858);
fis.set('swa.app.name'      , path.basename(process.cwd()));
fis.set('swa.server.deploy' , aWebServerReceivers);
fis.set('cdn.public.deploy' , aVendorCdnReceivers);
fis.set('cdn.private.deploy', aBizCdnReceivers);

/*如果是开发环境, 则将相对路径转换为绝对路径*/
if (sCurrentMedia === 'dev' || sCurrentMedia === 'development') {
  sContext = sRealContext;
  /*如果不是绝对路径, 则相对于当前路径进行解析*/
  if (sDevDeployPath.search(/^(?:[a-z]:|\/)/i) != 0) {
    sDevDeployPath = path.join(process.cwd(), sDevDeployPath);
  }

  fis.set('swa.server.deploy.dev.path', sDevDeployPath);

  mkdirp.sync(sDevDeployPath);

  fis.on('release:end', function(){

    if (fis.get('is.released')) {
      return;
    }

    fis.set('is.released', true);

    var cwd = process.cwd();
    process.chdir(sDevDeployPath);

    process.nextTick(function(){
      console.log('\nfis release 完成...');

      if (!oExOptions['do-not-open-dir']) {
        console.log('\n正在为您打开部署目录...');
        exec(`start ${sDevDeployPath}` , function(){});
        exec(`open ${sDevDeployPath}` , function(){});
      }

      /*安装依赖*/
      installDependencies()
      .then(function(){
        /*升级依赖*/
        return updateDependencies();
      })
      .then(function(){
        /*启动应用*/
        return startApp();
      })
      .then(function(){
        /*打开浏览器*/
        return openBrowser();
      })
      .then(function(){
        process.chdir(cwd);
        console.log('\n发布流程完成。');
        process.title = sTitle;
      })
      .catch(function(){
        process.chdir(cwd);
        console.log('\n发布流程出错，请自己到发布目录启动应用');
      });
    });

  });
}else{/*如果不是开发环境部署, 则初始化接收器并设置cdn访问路径*/
  fis.set('cdn.vendor.url', oConf['deploy']['cdn-vendor']['url']);
  fis.set('cdn.biz.url'   , oConf['deploy']['cdn-biz']['url']   );
  _initReceivers(aVendorCdnReceivers, oConf['deploy']['cdn-vendor']['receivers']);
  _initReceivers(aBizCdnReceivers   , oConf['deploy']['cdn-biz']['receivers']);
  _initReceivers(aWebServerReceivers, oConf['deploy']['swa-server']['receivers']);
}

fis.set('swa.context.dev' , sContext);
fis.set('swa.context.real', sRealContext);

/*设置 alias paths shim*/
require('./lib/bower-info.js').setModConf();

/*发布规则配置开始*/
/*所有文件发布到部署目录的相同路径*/
fis.match('/**', {
  release: '/$0',
  deploy: aWebServerReceivers
});

/*fis-optimizer-uglify-js 插件对js进行压缩*/
fis.match('**.{js,es}', {
  parser: [parserGetConf],
  optimizer: optimizerUglifyJs
});
fis.match('**.es', {
  parser: [parserGetConf, parserES6],
  rExt: '.js'
});

/*fis-optimizer-clean-css 插件对css进行压缩*/
fis.match('**.{css,less}', {
  parser: [parserGetConf],
  optimizer: optimizerCleanCss,
  useSprite: true
});

/*所有less文件编译为css*/
fis.match('**.less', {
  parser: [parserLess, parserGetConf],
  rExt: '.css'
});

/*对于已经压缩过的 css 和 js 文件不再进行压缩*/
fis.match('**.min.{css,js}', {
  optimizer: null
});

/*fis-optimizer-png-compressor 插件对png图片进行压缩, 该插件压缩比例为10%左右, 效果并不好。*/
fis.match('**.png', {
  optimizer: optimizerPngCompressor
});

/*对html、htm和tpl文件进行处理*/
fis.match('**.{hbs,html,htm}', {
  parser: [parserHtmlUri, parserGetConf]
});

/*静态文件打上md5戳，发布到s_p目录下*/
fis.match('**.{js,es,css,less,png,jpg,jpeg,gif,ico}',{
  useHash: true,
  useMap: true,
  release: '/s_p/$0',
  url: `${sContext}/s_p$0`,/*sContext*/
  domain: fis.get('cdn.private.url'),
  deploy: aBizCdnReceivers
});

/*vendors目录下的文件全部发布到vendors目录下*/
fis.match('/vendors/(**)', {
  release: "/vendors/$1",
  url: `${sContext}/vendors/$1`,/*sContext*/
  domain: fis.get('cdn.public.url'),
  deploy: aVendorCdnReceivers
});

/*所有的html文件全部发布到html目录下*/
fis.match('**.{html,htm}', {
  release: '/html/$0',
  url:  `${sRealContext}$0`,/*sContext*/
  domain: false,
  deploy: aWebServerReceivers
});

/*根目录下的文件不压缩, 不加戳*/
fis.match('/*', {
  release: '/$0',
  useHash: false,
  optimizer: null,
  deploy: aWebServerReceivers
});

/*模块化js的位置*/
fis.match('/{404, 500, apps, components, web}/**.{js,es}', {
  isMod: true,
  parser: [require('./lib/mod-js.js'), parserGetConf]
});
fis.match('/{404, 500, apps, components, web}/**.es', {
  parser: [parserES6, require('./lib/mod-js.js'), parserGetConf]
});

/*模块化html的处理*/
fis.match('/{404, 500, apps, components, web}/**.{html,htm,tpl}', {
  isMod: true,
  useMap: true
});

/*路由文件和action文件发布到/routes目录下,不进行压缩和md5*/
fis.match('*.{routes,actions,helper}.{js,es}', {
  release: '/routes/$0',
  url: '/routes$0',/*sContext*/
  useHash: false,
  useMap:true,
  optimizer: null,
  isMod: false,
  domain: false,
  deploy: aWebServerReceivers
});

/*组件路由文件和action文件发布到/routes目录下,不进行压缩和md5*/
fis.match('(/components/*)/**.routes.{js,es}', {
  mountPath: '$1',
  postprocessor: [require('./lib/postprocessor-components-routes.js')]
});

/*配置文件*/
fis.match('/conf/**', {
  release: '$0',
  url: '$0',/*sContext*/
  useHash: false,
  useMap:true,
  optimizer: null,
  isMod: false,
  domain: false,
  deploy: aWebServerReceivers
});

/*所有的模板文件全部发布到views目录下*/
fis.match('*.tpl', {
  release: "/views/$0",
  deploy: aWebServerReceivers
});

/*让html和tpl文件支持__uri方法*/
fis.match('*.{html,htm,tpl}', {
  isHtmlLike: true,
  parser: [parserHtmlUri, require('./lib/mod-html.js'), parserGetConf]
});

/*字体文件加MD5戳, 但是不压缩*/
fis.match('**.{eot,svg,ttf,woff}', {
  useHash: true,
  optimizer: null
});

/*平台说明文档不发布*/
/*release.bat不发布*/
fis.match('{/*.md, /doc/*, /readme.*, /release.*, /bin/*/**}', {
  release: false
});
/*隐藏文件不发布*/
fis.match(/^\..*/ ,{
  release: false
});

/*混入工具不发布也不解析*/
// fis.match('/vendors/mixins/**', {
//   parser: null,
//   release: false
// });

/*遍历 /vendors 目录, 确定每个组件的发布配置*/
// require('./lib/bower-info.js').setFisConf();

/*package阶段的处理*/
fis.match('::package', {
  prepackager: [
    require('./lib/generate-files.js'),
    require('./lib/seajs-conf.js')
  ],
  spriter: sprites,
  postpackager: [
    require('./lib/deps-process.js'), /*处理依赖*/ 
    require('./lib/media-process.js'), /*记录发布时候的media信息*/
    require('./lib/package-process.js'),
    require('./lib/components-routes-process.js')
  ]
});

/*---如果项目根目录下存在个性化的fis配置文件, 则加载并执行该文件---*/
const sFisConfPath = path.join(process.cwd(), 'conf', 'fis-conf-biz.js');
if (fs.existsSync(sFisConfPath)) {
  require(sFisConfPath);
}

/*开发环境发布*/
fis.media('dev') 
   .match('**', {
      deploy: fis.plugin('local-deliver', {
        to: sDevDeployPath
      }),
      optimizer: null,
      useHash: false,
      domain: false
   });
fis.media('development') 
   .match('**', {
      deploy: fis.plugin('local-deliver', {
        to: sDevDeployPath
      }),
      optimizer: null,
      useHash: false,
      domain: false
   });
fis.media('development-opti') 
   .match('**', {
      deploy: fis.plugin('local-deliver', {
        to: sDevDeployPath
      }),
      useHash: false,
      domain: false
   });

/*测试环境发布*/
fis.media('test'); 
fis.media('test-no-opti')
   .match('**', {
      optimizer: null
   }); 

/*上线验证发布*/
fis.media('preproduction'); 
fis.media('preproduction-no-opti')
   .match('**', {
      optimizer: null
   }); 

/*生产发布*/
fis.media('production'); 
fis.media('production-no-opti')
   .match('**', {
      optimizer: null
   }); 

/**
 * 根据配置文件初始化部署时的文件接收器
 * @author 康永胜
 * @date   2017-01-23T09:06:11+0800
 * @param  {Array}                  aRecievers [文件接收器数组]
 * @param  {Array}                  aConfs     [文件接收器的配置数组]
 * @return {undefined}                         []
 */
function _initReceivers(aRecievers, aConfs){
  aConfs = aConfs || [];
  var len = aConfs.length;
  for (var i = 0; i < len; i++) {
    aRecievers.push(
      fis.plugin('http-push', {
        receiver: aConfs[i]['url'],
        to: aConfs[i]['real-path']
      })
    );
  }
}

function installDependencies(){
  return new Promise(function(resolve, reject){
    if (oExOptions['do-not-install']) {
      resolve();
      return;
    }

    var cp = exec('npm install');
    process.stdout.write('\n安装依赖...');

    cp.stdout.pipe(process.stdout);

    var timer = setInterval(function(){
      process.stdout.write('...');
    }, 1000);

    cp.on('exit', function(){
      clearInterval(timer);
      resolve();
    });

    cp.on('uncaughtException', function(err){
      console.log('\n安装依赖出错|', err);
      reject();
    })
  });
}

function updateDependencies(){
  return new Promise(function(resolve, reject){
    if (oExOptions['do-not-update']) {
      resolve();
      return;
    }

    var cp = exec('npm update');
    
    process.stdout.write('\n升级依赖...');

    cp.stdout.pipe(process.stdout);

    var timer = setInterval(function(){
      process.stdout.write('...');
    }, 1000);

    cp.on('exit', function(){
      clearInterval(timer);
      resolve();
    });

    cp.on('uncaughtException', function(err){
      console.log('\n升级依赖出错|', err);
      clearInterval(timer);
      reject();
    })
  });
}

function startApp(){
  return new Promise(function(resolve, reject){
    if (oExOptions['do-not-run']) {
      resolve();
      return;
    }
    if (oExOptions['indie-run']) {
      indieRun().then(resolve).catch(reject);
      return;
    }

    childProcessRun().then(resolve).catch(reject);
  });
}

function childProcessRun() {
  var debugPort = fis.get('nodemon.debug.port') || 5858;
  var command = `nodemon -e js --debug=${debugPort} bin/www`;
  return new Promise((resolve, reject) => {
    var serverCp = exec(command);

    console.log();/*输出空行*/
    serverCp.stdout.on('data', chunk => {
      process.stdout.write(chunk);
    });

    setTimeout(resolve, 2000);
  });
}

function indieRun() {
  return new Promise((resolve, reject) => {
    var command;

    if(process.platform === 'win32'){
      command = 'start.bat';
    }else{
      command = 'chmod g+x sratr.sh; ./start.sh';
    }

    process.stdout.write('\n启动应用...');
    exec(command);

    setTimeout(function(){
      resolve();
    }, 2000);   
  });
}

function openBrowser(){
  if (oExOptions['do-not-open-browser']) {
    return;
  }
  
  process.stdout.write('\n打开默认浏览器...');
  var uri, args = [];

  var oDeploy = oConf['deploy'] || {};

  if (oDeploy['uri-to-open-after-running']) {
    uri = oDeploy['uri-to-open-after-running'];
  }else{
    var port = oConf['server-port'] || '';
    var context = oConf['context-and-multi-apps'] && 
                  oConf['context-and-multi-apps']['self'] &&
                  oConf['context-and-multi-apps']['self']['context-path'] ||
                  '';
    if (port) {
      port = ':' + port;
    }

    uri = 'http://127.0.0.1' + port + context;
  }

  args.push(uri);

  if (oDeploy['application-to-open-uri']) {
    args.push({app: oDeploy['application-to-open-uri']});
  }

  return open.apply(null, args);
}