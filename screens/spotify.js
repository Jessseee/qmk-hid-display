// Spotify page
const Screen = require('./screen.js');
const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyScreen extends Screen {
  init() {
    super.init();

    this.authWin = null;
    this.authWinClosedManually = false;
    this.loggedIn = false;

    //spotify api setup
    const spotifyClientId = this.nconf.get('spotifyClientId')
    const spotifyClientSecret = this.nconf.get('spotifyClientSecret')
    this.callbackUri = 'http://localhost/spotifyCallback'
    this.spotifyApi = new SpotifyWebApi({
      clientId: spotifyClientId,
      clientSecret: spotifyClientSecret,
      redirectUri: this.spotifyCallbackUri
    });
    this.startSpotifyMonitor();
  }

  updateTrayMenu() {
    if (this.loggedIn) {
      this.trayMenu = [{ label: 'Log out of Spotify', click: this.logOut }];
    } else {
      this.trayMenu = [{ label: 'Log in to Spotify', click: this.createAuthWin }];
    }
    this.updateTrayMenuCallback();
  }

  async startSpotifyMonitor() {
    console.log('starting spotify monitor')
    let refreshToken = this.nconf.get('refreshToken');
    this.spotifyApi.setRefreshToken(refreshToken);
    while (true) {
      if (this.spotifyApi.getRefreshToken() == '') {
        this.screen = ['Spotify: logged out'];
        this.loggedIn = false;
        this.updateTrayMenu();
      } else {
        this.spotifyApi.getMyCurrentPlaybackState({})
          .then((data) => {
            // Output items
            if (data.body.item) {
              // Song name
              const songName = data.body.item.name;

              // Progress bar
              const progress = data.body.progress_ms / data.body.item.duration_ms;
              const progressQuantized = Math.floor(19 * progress);
              const progressRemainder = progress * 19 - progressQuantized;
              const progressRemainderQuantized = Math.floor(progressRemainder * 6);

              let progressBar = '\u009b'.repeat(progressQuantized) + String.fromCharCode(149 + progressRemainderQuantized);
              progressBar += ' '.repeat(19 - Math.min(progressBar.length, 19));
              progressBar = '\u009c' + progressBar + '\u009d';

              // Time
              let curS = Math.floor((data.body.progress_ms / 1000) % 60);
              let curM = Math.floor((data.body.progress_ms / 1000 - curS) / 60);
              let totalS = Math.floor(data.body.item.duration_ms / 1000) % 60;
              let totalM = Math.floor((data.body.item.duration_ms / 1000 - totalS) / 60);
              if (curS < 10) {
                curS = '0' + curS;
              }
              if (totalS < 10) {
                totalS = '0' + totalS
              }

              const duration = curM + ':' + curS + '/' + totalM + ':' + totalS;
              const durationLine = '\u000e' + ' '.repeat(20 - duration.length) + duration;
              this.screen = [songName, '', progressBar, durationLine];
            }
            this.loggedIn = true;
            this.updateTrayMenu();

          }, (err) => {
            console.log('Something went wrong!', err);
            this.screen = ['Spotify not connected.'];
            this.spotifyApi.refreshAccessToken().then(
              (data) => {
                console.log('The access token has been refreshed!');
                this.spotifyApi.setAccessToken(data.body['access_token']);
                this.loggedIn = true;
                this.updateTrayMenu();
              },
              (err) => {
                console.log('Could not refresh access token', err);
                this.loggedIn = false;
                this.updateTrayMenu();
                if (!this.authWinClosedManually) {
                  this.createAuthWin();
                }
              }
            )
          });
      }
      this.updateScreenCallback();
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
          console.log('logged in');
          this.loggedIn = true;
          this.updateTrayMenu();
        },
        (err) => {
          console.log('Something went wrong in auth!', err);
          this.loggedIn = false;
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
    this.loggedIn = false;
    this.closedWindowManually = true;
    this.updateTrayMenu();
  }
}

module.exports = SpotifyScreen;
