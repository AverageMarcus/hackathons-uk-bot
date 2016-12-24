"use strict";
const Twitter = require('twitter');
const restify = require('restify');
const fetch = require('node-fetch');
const parseDiff = require('parse-diff');

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const server = restify.createServer({});
server.use(restify.bodyParser());

const monthRegex = /\| \*\*(\w+)\*\* \|/;
const hackathonRegex = /\| \[(.+)\]\((.*)\) \| (.+) \| (.+) \|/;

function sendTweet(tweetMessage) {
  client.post('statuses/update', {status: tweetMessage}, (error, myTweet, response) => {
    if (error) {
      console.log(error);
    }
  });
}

function parseWebhook(res) {
  if(res.compare && res.ref === 'refs/heads/master') {
    let diffUrl = res.compare + '.diff';
    let rawUrl = `https://raw.githubusercontent.com/${res.repository.full_name}/${res.head_commit.id}/README.md`;
    let hasReadmeUpdated = res.commits.some(commit => commit.modified.indexOf('README.md') >= 0);
    let isIgnoreTweet = res.head_commit.message.toUpperCase().indexOf('NO TWEET') >= 0;

    if(hasReadmeUpdated && !isIgnoreTweet) {
      fetch(diffUrl)
        .then(res => res.text())
        .then(diff => {
          diff = parseDiff(diff);
          let additions = [];
          diff[0].chunks.forEach(chunk => {
            chunk.changes.forEach(change => {
              if(change.add) {
                additions.push(change.content.replace('+', ''));
              }
            });
          });
          fetch(rawUrl)
            .then(res => res.text())
            .then(readme => {
              let lines = readme.split('\n');
              let currentMonth = '';
              for(let line of lines) {
                if(line.match(monthRegex)) {
                  currentMonth = line.match(monthRegex)[1];
                } else if(additions.indexOf(line) >= 0 && line.match(hackathonRegex)) {
                  let title = line.match(hackathonRegex)[1];
                  let url = line.match(hackathonRegex)[2];
                  let date = line.match(hackathonRegex)[3];
                  let location = line.match(hackathonRegex)[4];
                  let message = `🆕 Hackathon added | ${title} | ${currentMonth} ${date} | ${location} | ${url}`;
                  sendTweet(message);
                }
              }
            });
        });
    }
  }
}

server.post('/webhook', (req, res, next) => {
  parseWebhook(req.body);
  res.send(200);
});


server.listen(process.env.PORT);