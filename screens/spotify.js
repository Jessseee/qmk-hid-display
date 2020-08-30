// Spotify page
'use strict';

const Screen = require('./screen.js');
const SpotifyWebApi = require('spotify-web-api-node');

const states = {
  loggedOut: 0,
  notPlaying: 1,
  playing: 2,
  refreshing: 3,
  booting: 4
};
Object.freeze(states);

class SpotifyScreen extends Screen {
  init() {
    super.init();
    this.name = 'Spotify';

    this.authWin = null;
    this.authWinClosedManually = false;

    //spotify api setup
    const spotifyClientId = this.nconf.get('spotifyClientId')
    const spotifyClientSecret = this.nconf.get('spotifyClientSecret')
    this.callbackUri = 'http://localhost/spotifyCallback'
    this.spotifyApi = new SpotifyWebApi({
      clientId: spotifyClientId,
      clientSecret: spotifyClientSecret,
      redirectUri: this.spotifyCallbackUri
    });

    // updated by the monitor
    this.state = states.loggedOut;
    this.songInfo = {};
  }

  activate() {
    // If we have a running loop, then wait for it to finish and then start
    // a new one
    if (this.runningMonitor && !this.active) {
      this.runningMonitor.then(() => {
        super.activate();
        this.runningMonitor = this.spotifyMonitor();
      });
    } else {
      super.activate();
      this.state = states.booting;
      this.runningMonitor = this.spotifyMonitor();
    }
  }

  updateTrayMenu() {
    if (this.state == states.loggedOut) {
      this.trayMenu = [{ label: 'Log in to Spotify', click: this.createAuthWin }];
    } else {
      this.trayMenu = [{ label: 'Log out of Spotify', click: this.logOut }];
    }
    super.updateTrayMenu();
  }

  updateScreen() {
    if (this.state == states.loggedOut) {
      this.screen = ['Spotify: Logged Out'];
    } else if (this.state == states.notPlaying) {
      this.screen = ['Spotify: Connected'];
    } else if (this.state == states.playing) {
      if (this.songInfo && this.songInfo.item) {
        const songName = this.songInfo.item.name;
        const progress = this.songInfo.progress_ms / this.songInfo.item.duration_ms;
        const progressBar = this.screenBar(progress);

        // Time
        let curS = Math.floor((this.songInfo.progress_ms / 1000) % 60);
        let curM = Math.floor((this.songInfo.progress_ms / 1000 - curS) / 60);
        let totalS = Math.floor(this.songInfo.item.duration_ms / 1000) % 60;
        let totalM = Math.floor((this.songInfo.item.duration_ms / 1000 - totalS) / 60);
        if (curS < 10) {
          curS = '0' + curS;
        }
        if (totalS < 10) {
          totalS = '0' + totalS
        }
        const duration = curM + ':' + curS + '/' + totalM + ':' + totalS;
        const durationLine = '\u000e' + ' '.repeat(this.displayWidth - 1 - duration.length) + duration

        this.screen = [songName, '', progressBar, durationLine];
      } else {
        this.screen = ['Invalid song info'];
      }
    } else if (this.state == states.booting) {
      if (this.screen.length == 0) {
        this.screen = ['Spotify'];
      }
    }

    super.updateScreen();
  }

  async spotifyMonitor() {
    let refreshToken = this.nconf.get('refreshToken');
    this.spotifyApi.setRefreshToken(refreshToken);
    while (true) {
      if (!this.active) {
        break;
      }
      if (this.spotifyApi.getRefreshToken() == '') {
        this.state = states.loggedOut;
        this.updateTrayMenu();
      } else {
        this.spotifyApi.getMyCurrentPlaybackState({})
          .then((data) => {
            // Output items
            if (data.body.item) {
              this.songInfo = data.body;
            }
            this.state = states.playing;
            this.updateTrayMenu();
          }, (err) => {
            this.log('Spotify err: ' + err);
            this.states = states.refreshing;
            this.spotifyApi.refreshAccessToken().then(
              (data) => {
                this.log('The access token has been refreshed!');
                this.spotifyApi.setAccessToken(data.body['access_token']);
                this.updateTrayMenu();
              },
              (err) => {
                this.log('Could not refresh access token', err);
                this.state = state.loggedOut;
                this.updateTrayMenu();
                if (!this.authWinClosedManually) {
                  this.createAuthWin();
                }
              }
            )
          });
      }
      this.requestUpdateScreen();
      await this.wait(1000);
    }
  }

  createAuthWin() {
    if (this.authWin) {
      return;
    }
    this.authWin = new BrowserWindow({
      width: 500,
      height: 900,
    });
    const scopes = ['user-read-private',
      'user-read-email',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing'];
    const authUrl = spotifyApi.createAuthorizeURL(scopes, 'randomstate');
    // for whatever reason this doesnt work unless i load this first
    this.authWin.loadURL('about:blank');
    this.authWin.loadURL(authUrl);

    const {session: {webRequest}} = this.authWin.webContents;

    const filter = {
      urls: [
        this.callbackUri + '*'
      ]
    };
    webRequest.onBeforeRequest(filter, async ({url}) => {
      const code = new URLSearchParams(url.substr(this.callbackUri.length)).get('code');
      this.spotifyApi.authorizationCodeGrant(code).then(
        (data) => {
          const accessToken = data.body.access_token,
            refreshToken = data.body.refresh_token;
          this.spotifyApi.setAccessToken(accessToken);
          this.spotifyApi.setRefreshToken(refreshToken);
          this.nconf.set('refreshToken', refreshToken);
          this.nconf.save('user');
          this.log('logged in');
          this.state = true;
          this.updateTrayMenu();
        },
        (err) => {
          this.log('Something went wrong in auth!', err);
          this.state = states.refreshing;
          this.updateTrayMenu();
        }
      )
      return this.destroyAuthWin();
    });

    this.authWin.on('authenticated', () => {
      this.authWinClosedManually = false;
      this.destroyAuthWin();
    });

    spotifyAuthWin.on('closed', () => {
      this.authWinClosedManually = true;
      this.authWin = null;
    });
  }

  destroyAuthWin() {
    if (!this.authWin) return;
    this.authWin.close();
    this.authWin = null;
  }

  logOut()
  {
    this.session.defaultSession.clearStorageData([], (data) => {});
    this.spotifyApi.setRefreshToken('');
    this.spotifyApi.setAccessToken('');
    this.nconf.set('refreshToken', '');
    this.nconf.save('user');
    this.states = state.loggedOut;
    this.closedWindowManually = true;
    this.updateTrayMenu();
  }
}

module.exports = SpotifyScreen;
