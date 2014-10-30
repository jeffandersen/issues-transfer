var issuesTransfer = exports; exports.constructor = function issuesTransfer(){};

var _ = require('lodash');
var async = require('async');
var GithubApi = require('github');

var sample = 'organization/repo-name';

var testToken = 'a98f1a357211f15df7c2930aa634a4a13b875605';

function IssuesTransfer(opts) {
  this.token = opts.token || opts.t;
  this.sourceRepo = opts.from;
  this.destinationRepo = opts.to;
  this.state = opts.state || 'open';
  this.labels = opts.labels || true;
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

  this.github = new GithubApi({
    version: '3.0.0'
  });

  this.github.authenticate({
    type: 'oauth',
    token: this.token
  });
}

IssuesTransfer.prototype.run = function(cb) {
  var self = this;
  var issuesFound = [];
  var hasNextPage = true;

  var sourceUser = this.sourceRepo.split('/');
  if (sourceUser.length !== 2) {
    throw new Error('--from option must be slash delimited user/repo');
  }

  var sourceOpts = {
    state: this.state,
    user: sourceUser[0],
    repo: sourceUser[1],
    per_page: 100,
    page: 1
  };

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
        labels: self.labels ? _.pluck(issue.labels, 'name') : []
      };

      self.github.issues.create(createOpts, next);
    }, function(err) {
      if (err) {
        console.error('Failed to create issue');
        return cb(err);
      }

      cb();
    });
  }
};

issuesTransfer.IssuesTransfer = IssuesTransfer;
