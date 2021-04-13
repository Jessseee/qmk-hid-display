// single notifications page
'use strict';

const NotificationsScreen = require('./notifications.js');

class NotificationsSingleScreen extends NotificationsScreen {
  init() {
    super.init();
    this.name = 'Notifications Single';
  }

  generateScreenOutput() {
    this.screen = [];
    if (this.notifications.length > 0) {
      let notification = this.notifications[0];
      this.screen.push(this.screenScroll(notification.appName));
      this.screen.push(...this.screenSplit(notification.contents, 3));
    }
  }
}

module.exports = NotificationsSingleScreen;
