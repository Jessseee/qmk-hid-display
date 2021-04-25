// single notifications page
'use strict';

const NotificationsScreen = require('./notifications.js');

class NotificationsSingleScreen extends NotificationsScreen {
  constructor(...args) {
    super(...args);
    this.name = 'Notifications Single';
    this.storePrefix = 'screens-notificationsSingle-';
  }

  generateScreenOutput() {
    this.screen = [];
    if (this.notifications.length > 0) {
      let notification = this.notifications[0];
      this.screen.push(this.screenScroll(notification.appName));
      this.screen.push(...this.screenSplit(notification.contents, 3));
    } else {
      this.screen.push(...['', '', '']);
      this.screen.push('[no notifications]');
    }
  }
}

module.exports = NotificationsSingleScreen;
