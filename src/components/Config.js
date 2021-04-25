'use strict';

import React from 'react';
const { ipcRenderer } = window.require('electron');
import { withStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import CssBaseline from '@material-ui/core/CssBaseline';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import List from '@material-ui/core/List';
import Typography from '@material-ui/core/Typography';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import TextField from '@material-ui/core/TextField';
import ListSubHeader from '@material-ui/core/ListSubHeader';

class Config extends React.Component {
  constructor(props) {
    super(props);
    this.state = {page: 'Keyboard', pages: []};

    ipcRenderer.invoke('get-pages').then((result) => {
      if (!result) {
        result = [];
      }
      this.setState({pages: result});
    });
  }
  setPage(text) {
    this.setState({page: text});
  }

  render () {
    const { classes } = this.props;
    return (
      <div className={classes.root}>
      <CssBaseline />
      <AppBar position="fixed" className={classes.appBar}>
        <Toolbar>
          <Typography variant="h6" noWrap>
            {this.state.page}
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        className={classes.drawer}
        variant="permanent"
        anchor="left"
        classes={{
          paper: classes.drawerPaper,
        }}>
      <div className={classes.toolbar} />
        <List>
          {this.state.pages.map((text, index) => (
            <ListItem button key={text} onClick={() => this.setPage(text)}>
            <ListItemText primary={text} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <main className={classes.content}>
        <div className={classes.toolbar} />
        <ConfigPage key={this.state.page} page={this.state.page} />
      </main>
    </div>
  );
  }
}

class ConfigPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = { groups: [] };
    ipcRenderer.invoke('get-page-groups', this.props.page).then((result) => {
      if (!result) {
        result = [];
      }
      this.setState({groups: result});
    });
  }

  render() {
    return (
      <List>
      {this.state.groups.filter(group => !group.hidden).map((group, index) =>
        <ConfigGroup key={index} label={group.label} params={group.params} />)}
      </List>
    );
  }
}

class ConfigGroup extends React.Component {
  constructor(props) {
    super(props);
  };

  render() {
    return (
      <>
      {this.props.label ? <ListSubHeader>{this.props.label}</ListSubHeader> : '' }
        {Object.entries(this.props.params)
          .map(entry => {
            let [key, options] = entry;
            return <ConfigField key={key} field={key} label={options.label}/>
        })}
      </>
    );
  }
}

class ConfigField extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: ''};
    ipcRenderer.invoke('get-config', this.props.field).then((result) => {
      if (!result) {
        result = '';
      }
      this.setState({value: result});
    });
  }

  handleChange(event) {
    this.setState({value: event.target.value});
    ipcRenderer.send('set-config',
      {key: this.props.field, value: event.target.value});
  }

  render() {
    return (
      <ListItem key={this.props.field}>
        <TextField key={this.props.field}
          label={this.props.label ? this.props.label : this.props.field}
          value={this.state.value} onChange={this.handleChange} />
      </ListItem>
    );
  }
}

// not that clean but whatevs
const drawerWidth = 240;
const styles = theme => ({
  root: {
    display: 'flex',
  },
  appBar: {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: drawerWidth,
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  // necessary for content to be below app bar
  toolbar: theme.mixins.toolbar,
  content: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(3),
  },
});

export default withStyles(styles)(Config);
