var issuesTransfer = exports; exports.constructor = function issuesTransfer(){};

var _ = require('lodash');
var async = require('async');
var prompt = require('prompt');
var GithubApi = require('github');

var sample = 'organization/repo-name';

function IssuesTransfer(opts) {
  if (opts.h || opts.help || (opts['_'] && Object.keys(opts).length === 1)) {
    this.help = true;
    return;
  }

  this.token = opts.token || opts.t;
  this.sourceRepo = opts.from;
  this.destinationRepo = opts.to;
  this.transferLabels = opts['transfer-labels'] || true;
  this.transferAssignee = opts['transfer-assignees'] || true;
  this.onlyLabels = opts['only-labels'] || null;
  this.autoClose = opts['auto-close'] || false;
  this.link = opts.link || true;

  if (!_.isString(this.token)) {
    throw new Error('--token option required (e.g --token=abc123)');
  }

  if (!_.isString(this.sourceRepo)) {
    throw new Error('--from option required (eg. --from=' + sample + ')');
  }

  if (!_.isString(this.destinationRepo)) {
    throw new Error('--to option required (eg. --to=' + sample + ')');
  }

  console.log('Beginning transfer of issues');
  console.log('--------------------------Options-----------------------------');
  console.log('Source repository \t\t', this.sourceRepo);
  console.log('Destination repository \t\t', this.destinationRepo);
  console.log('Transfer labels? \t\t', !!this.transferLabels ? 'Yes' : 'No');
  console.log('Transfer assignee? \t\t', !!this.transferAssignee? 'Yes' : 'No');
  if (this.onlyLabels) {
    console.log('Only transfer labelled as \t', this.onlyLabels);
  }
  console.log('-------------------------------------------------------------');

  this.github = new GithubApi({
    version: '3.0.0'
  });

  this.github.authenticate({
    type: 'oauth',
    token: this.token
  });
}

IssuesTransfer.prototype.showHelp = function(cb) {
  var requiredArgs = [
    '--token <token>',
    '--from <user/repo>',
    '--to <user/repo>'
  ];

  var optionalArgs = [
    '\t--transfer-labels\t\t Whether to copy labels with the issue',
    '\t--transfer-assignees\t\t Whether to copy assignees with the issue',
    '\t--auto-close\t\t\t Close source issue after creating new',
    '\t--only-labels <labels,to,copy>\t Only copy issues with particular labels'
  ];

  console.log('\nUsage:\n\nissues-transfer ' + requiredArgs.join(' '));
  console.log('\nAvailable options:\n' + optionalArgs.join('\n'));
  console.log('\n');

  cb();
};

IssuesTransfer.prototype.run = function(cb) {
  var self = this;

  if (self.help) {
    return self.showHelp(cb);
  }

  prompt.delimiter = '';
  prompt.message = '';
  prompt.start();

  var question = 'Continue? [Y/n]';
  prompt.get(question, function(err, result) {
    if (err) {
      return cb(err);
    }

    var answer = result[question].toLowerCase();
    if (answer === 'n') {
      return cb();
    }

    self._run(cb);
  });
};

IssuesTransfer.prototype._run = function(cb) {
  var self = this;
  var issuesFound = [];
  var hasNextPage = true;

  var sourceUser = this.sourceRepo.split('/');
  if (sourceUser.length !== 2) {
    throw new Error('--from option must be slash delimited user/repo');
  }

  var sourceOpts = {
    state: 'open',
    user: sourceUser[0],
    repo: sourceUser[1],
    per_page: 100,
    page: 1
  };

  if (self.onlyLabels) {
    sourceOpts.labels = self.onlyLabels;
  }

  async.whilst(
    continueWalking,
    lookupIssues,
    processIssues
  );

  function continueWalking() {
    return hasNextPage;
  }

  function lookupIssues(next) {
    self.github.issues.repoIssues(sourceOpts, function(err, res) {
      if (err) {
        return next(err);
      }

      sourceOpts.page++;
      hasNextPage = (res.length > 0);
      issuesFound = issuesFound.concat(res);

      next();
    });
  }

  function processIssues(err) {
    if (err) {
      console.error('Failed to lookup issues');
      return cb(err);
    }

    var destinationUser = self.destinationRepo.split('/');
    if (destinationUser.length !== 2) {
      throw new Error('--to option must be slash delimited user/repo');
    }

    var created = 0;
    async.eachSeries(issuesFound, function(issue, next) {
      var boilerplate = 'Transferred from: ' + issue.html_url + '\r\n\r\n';
      if (self.link === false) {
        boilerplate = '';
      }

      var createOpts = {
        title: issue.title,
        body: boilerplate + issue.body,
        user: destinationUser[0],
        repo: destinationUser[1],
        labels: self.transferLabels ? _.pluck(issue.labels, 'name') : []
      };

      if (self.transferAssignee && issue.assignee) {
        createOpts.assignee = issue.assignee.login;
      }

      self.github.issues.create(createOpts, function(err) {
        if (err) {
          return next(err);
        }

        created++;
        next();
      });
    }, function(err) {
      if (err) {
        console.error('Failed to create issue');
        return cb(err);
      }


      console.log('Issues transferred \t\t', created);
      cb(null);
    });
  }
};

issuesTransfer.IssuesTransfer = IssuesTransfer;
