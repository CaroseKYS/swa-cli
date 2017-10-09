const should = require('should');
const rewire = require('rewire');

describe('/scripts/postinstall.js 测试', () => {
  var postinstall;

  describe('加载测试', function() {
    it('', function(done) {
      this.timeout(10000);
      postinstall = rewire('../scripts/postinstall.js');
      setTimeout(() => {
        done();
      }, 8000);
    });
  });


});