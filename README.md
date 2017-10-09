# swa-cli
swa平台的命令行工具，用于完成 **环境搭建**、**项目编译** 等功能。

## 使用方式

### 安装

    [sudo] npm install fdp-cli -g --unsafe-perm

该模块安装以后会自动进行 `fis3`, `fis-parser-less`, `fis3-parser-html-uri`, `fis3-parser-get-conf`, `fis3-hook-module`, `fis-parser-babel-6.x`, `pm2`, `bower`, `nodemon`, `node-inspector`, `http-server` 等模块的 **全局** 安装工作，为应用开发和运行准备基础环境。

### 升级

    [sudo] npm update  fdp-cli -g --unsafe-perm

### 卸载

    [sudo] npm uninstall fdp-cli -g