// notifications page
'use strict';

const { LoopingScreen } = require('./screen.js');
const NotificationManagement = require('@nodert-win10-20h1/windows.ui.notifications.management');
const Notifications = require('@nodert-win10-20h1/windows.ui.notifications');

class Notification {
  constructor(userNotification) {
    this.id = userNotification.id;
    this.creationTime = userNotification.creationTime;
    this.appName = userNotification.appInfo.displayInfo.displayName;

    let contentsArr = [];
    let bindings = userNotification.notification.visual.bindings;
    for (let binding = 0; binding < bindings.size; bindings++) {
      let textElements = bindings[binding].getTextElements();
      for (let element = 0; element < textElements.size; element++) {
        contentsArr.push(textElements[element].text);
      }
    }

    this.contents = contentsArr.join(' ');
  }
}

class NotificationsScreen extends LoopingScreen {
  init() {
    super.init();
    this.name = 'Notifications';
    this.notifications = [];
    this.notificationIds = new Set();
    this.updating = false;

    this.currentListener = NotificationManagement.UserNotificationListener.current;
  }

  updateNotifications() {
    if (this.updating) {
      return;
    }
    this.updating = true;
    // Would like to not poll for full list of notifications every tick, but
    // this.currentListener.on('NotificationChanged', ...) gives me
    // "Element not found", and I can't figure out what that means
    this.currentListener.getNotificationsAsync(
      Notifications.NotificationKinds.toast,
      (err, res) => {
        // First, check if we have any differences in notifications
        let notificationsChanged = false;
        notificationsChanged |= this.notificationIds.size != res.size;
        if (!notificationsChanged) {
          for (let i = 0; i < res.size; i++) {
            let notificationId = res[i].id;
            notificationsChanged |= !this.notificationIds.has(notificationId);
          }
        }

        // If notifications changed, reset our internal lists and repopulate
        if (notificationsChanged) {
          this.notifications = [];
          this.notificationIds.clear();
          for (let i = 0; i < res.size; i++) {
            let userNotification = res[i];
            this.notifications.push(new Notification(userNotification));
            this.notificationIds.add(userNotification.id);
          }
          this.notifications.sort((a, b) => {
            return b.creationTime - a.creationTime;
          });
        }

        this.updating = false;
      })
  }

  update() {
    this.updateNotifications();
    this.updateScreen();
  }

  generateScreenOutput() {
    this.screen = [];
    for (let i = 0; i < Math.min(4, this.notifications.length); i++) {
      let notification = this.notifications[i];
      this.screen.push(this.screenScroll(notification.contents, 1000,
        this.screenScroll(notification.appName, 1000, '', 6) + '|'));
    }
  }

  updateScreen() {
    this.generateScreenOutput();
    super.updateScreen();
  }
}

module.exports = NotificationsScreen;
