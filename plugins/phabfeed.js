const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

module.exports = function (bot) {
    var plugin = this;

    var phabKeyFilename = bot.config.get('plugins.phabfeed.ckeyfile', './db/lastSeenPhabKey.txt');
    var phabApiToken = bot.config.get('plugins.phabfeed.apitoken', '');
    var phabServer = bot.config.get('plugins.phabfeed.server', '');
    var phabInterval = bot.config.get('plugins.phabfeed.fetchinterval', '10');
    var phabOutputs = bot.config.get('plugins.phabfeed.outputs');
    var autoStartFetch = bot.config.get('plugins.phabfeed.autostart', 'true');

    var fetchInterval;
    var before = 0;
    var fetching = false;

    if (phabApiToken == '') {
      bot.error('Phabricator API-Token not present in configuration file');
      return;
    }
    if (phabServer == '') {
      bot.error('Phabricator server address not present in configuration file');
      return;
    }

    function setLastSeen(chronoKey = null) {
      if (chronoKey || chronoKey === 0) {
          bot.log('Changing Last Seen ChronologicalKey');
          before = chronoKey;
          fs.writeFileSync(phabKeyFilename, before);
      } else {
        try {
          before = fs.readFileSync(phabKeyFilename, "utf-8");
        } catch (err) {
          var fd = fs.openSync(phabKeyFilename, 'w');
          fs.closeSync(fd);
          before = 0;
        }
      }
    }

    plugin.addCommand(['pf', 'phabfeed'], function (cmd) {
      var args = cmd.args.split(/\s+/);
      switch(args[0]) {
        case 'now':
          fetchFeed(cmd.network, cmd.target);
          break;
        case 'interval':
        case 'time':
          phabInterval = args[1];
          if (!fetching) {
            bot.say(cmd.network, cmd.replyto, 'Setting read interval to ' + phabInterval + ' minutes.');
            break;
          } else {
            stopAutoFetch();
          }
          // else fall through case to restart
        case 'start':
          bot.say(cmd.network, cmd.replyto, 'Starting to read ' + phabServer + ' every ' + phabInterval + ' minutes.');
          startAutoFetch();
          break;
        case 'stop':
          bot.say(cmd.network, cmd.replyto, 'Stopping reads of ' + phabServer);
          stopAutoFetch();
          break;
        case 'setseen':
          setLastSeen(args1);
          bot.say(cmd.network, cmd.replyto, 'Setting last seen ChronologicalKey to ' + before);
        case 'clearseen':
          setLastSeen(0);
          break;
      }
    });

    function startAutoFetch() {
      fetching = true;
      bot.log('Beginning Phabricator Feed Fetching');
      fetchInterval = setInterval(function(){
        for (transport in phabOutputs) {
          fetchFeed(transport, phabOutputs[transport]);
        }
      }, phabInterval * 60000);
    }

    function stopAutoFetch() {
        clearInterval(fetchInterval);
        fetchInterval = null;
        fetching = false;
    }

    function fetchFeed(network, target){
      var respBuffer = "";
      setLastSeen();
      if (before == '') { before = 0; }
      feedQuery = querystring.stringify({
        'api.token': phabApiToken,
        'before': before,
        'view': 'text'
      });

      var options = {
        hostname: phabServer,
        path: '/api/feed.query',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(feedQuery)
        }
      };
      const req = https.request(options, function (res) {
        res.on('data', function (chunk) {
          respBuffer += chunk.toString();
        });
        res.on('end', function () {
          //TODO handle error responses
          var newestResponse = true;
          var jsonResp = JSON.parse(respBuffer);
          for(var phid in jsonResp.result) {
            bot.say(network, target, jsonResp.result[phid].text);
            //log the chronokey
            if (newestResponse) {
              //fs.writeFileSync(phabKeyFilename, jsonResp.result[phid].chronologicalKey);
              setLastSeen(jsonResp.result[phid].chronologicalKey);
              newestResponse = false;
            }
          }
        });
      });
      req.write(feedQuery);
      req.end();
    }
};
