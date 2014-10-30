#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var IssuesTransfer = require('../index').IssuesTransfer;

function main() {
  var issuesTransfer = new IssuesTransfer(argv);
  issuesTransfer.run(function(err) {
    if (err) {
      console.error(err);
      return process.exit(1);
    }
  
    console.log('Complete.');
  });
}

if (require.main === module) {
  main();
}
