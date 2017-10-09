const should = require('should');
const rewire = require('rewire');

describe('/scripts/postinstall.js 测试', () => {
  var postinstall;

  describe('加载测试', () => {
    it('', () => {
      postinstall = rewire('../scripts/postinstall.js');
    });
  });


});