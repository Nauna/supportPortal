/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
  Accessible through browser at location path static/foam2/src/foam/nanos/controller/index.html
  Available on browser console as ctrl. (exports axiom)
*/

foam.CLASS({
  package: 'foam.nanos.controller',
  name: 'ApplicationController',
  extends: 'foam.u2.Element',

  documentation: 'FOAM Application Controller.',

  implements: [
    'foam.box.Context',
    'foam.nanos.controller.AppStyles'
  ],

  requires: [
    'foam.nanos.client.ClientBuilder',
    'foam.nanos.auth.Group',
    'foam.nanos.auth.ResendVerificationEmail',
    'foam.nanos.auth.SignInView',
    'foam.nanos.auth.User',
    'foam.nanos.auth.resetPassword.ResetView',
    'foam.nanos.u2.navigation.TopNavigation',
    'foam.u2.stack.Stack',
    'foam.u2.stack.StackView'
  ],

  imports: [
    'installCSS',
    'sessionSuccess',
    'window'
  ],

  exports: [
    'as ctrl',
    'group',
    'loginSuccess',
    'logo',
    'requestLogin',
    'signUpEnabled',
    'stack',
    'currentMenu',
    'lastMenuLaunched',
    'menuListener',
    'lastMenuLaunchedListener',
    'user',
    'webApp',
    'wrapCSS as installCSS'
  ],

  constants: {
    MACROS: [ 'primaryColor', 'secondaryColor', 'tableColor', 'tableHoverColor', 'accentColor' ]
  },

  css: `
    body {
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      letter-spacing: 0.2px;
      color: #373a3c;
      background: #edf0f5;
      margin: 0;
    }
    .foam-u2-UnstyledActionView-signIn {
      margin-left: 25px !important;
    }
    .stack-wrapper {
      margin-bottom: -10px;
      min-height: calc(80% - 60px);
    }
    .stack-wrapper:after {
      content: "";
      display: block;
    }
    .foam-u2-UnstyledActionView:focus{
      outline: none;
    }
  `,

  properties: [
    {
      name: 'clientPromise',
      factory: function() {
        var self = this;
        return self.ClientBuilder.create().promise.then(function(cls) {
          return cls.create(null, self);
        });
      },
    },
    {
      name: 'stack',
      factory: function() { return this.Stack.create(null, this.__subSubContext__); }
    },
    {
      class: 'foam.core.FObjectProperty',
      of: 'foam.nanos.auth.User',
      name: 'user',
      factory: function() { return this.User.create(null, this.__subSubContext__); }
    },
    {
      class: 'foam.core.FObjectProperty',
      of: 'foam.nanos.auth.Group',
      name: 'group',
      factory: function() { return this.Group.create(null, this.__subSubContext__); }
    },
    {
      class: 'Boolean',
      name: 'signUpEnabled',
      adapt: function(_, v) {
        return foam.String.isInstance(v) ? v !== 'false' : v;
      }
    },
    {
      class: 'Boolean',
      name: 'loginSuccess'
    },
    { class: 'URL', name: 'logo' },
    'currentMenu',
    'lastMenuLaunched',
    'webApp',
    'primaryColor',
    'secondaryColor',
    'tableColor',
    'tableHoverColor',
    'accentColor'
  ],

  methods: [
    function init() {
      this.SUPER();
      var self = this;
      self.clientPromise.then(function(client) {
        self.__subSubContext__ = client.__subContext__;
        foam.__context__.register(foam.u2.UnstyledActionView, 'foam.u2.ActionView');
        self.getCurrentUser();

        window.onpopstate = function(event) {
          if ( location.hash != null ) {
            var hid = location.hash.substr(1);

            hid && self.__subSubContext__.menuDAO.find(hid).then(function(menu) {
              menu && menu.launch(this, null);
            });
          }
        };

        window.onpopstate();
      });
    },

    function initE() {
      var self = this;
      self.clientPromise.then(function() {
        self
          .addClass(self.myClass())
          .tag({class: 'foam.nanos.u2.navigation.TopNavigation'})
          .start('div').addClass('stack-wrapper')
            .tag({class: 'foam.u2.stack.StackView', data: self.stack, showActions: false})
          .end();
      });
    },

    function setDefaultMenu() {
      // Don't select default if menu already set
      if ( this.window.location.hash || ! this.user.group ) return;

      this.__subSubContext__.groupDAO.find(this.user.group).then(function (group) {
        this.group.copyFrom(group);
        this.window.location.hash = group.defaultMenu;
      }.bind(this));
    },

    function getCurrentUser() {
      var self = this;

      // get current user, else show login
      this.__subSubContext__.auth.getCurrentUser(null).then(function (result) {
        self.loginSuccess = !! result;
        if ( result ) {
          self.user.copyFrom(result);
          if ( ! self.user.emailVerified ) {
            self.stack.push({ class: 'foam.nanos.auth.ResendVerificationEmail' });
            return;
          }
          self.onUserUpdate();
        }
      })
      .catch(function (err) {
        self.requestLogin().then(function() {
          self.getCurrentUser();
        });
      });
    },

    // CSS preprocessor, works on classes instantiated in subContext
    function wrapCSS(text, id) {
      if ( text ) {
        if ( ! this.accentColor ) {
          var self = this;

          this.accentColor$.sub(function(s) {
            self.wrapCSS(text, id);
            s.detach();
          });
        }

        for ( var i = 0 ; i < this.MACROS.length ; i++ ) {
          var m = this.MACROS[i];
          text = text.replace(new RegExp("%" + m.toUpperCase() + "%"), this[m]);
        }
        this.installCSS(text, id);
      }
    },

    function requestLogin() {
      var self = this;

      // don't go to log in screen if going to reset password screen
      if ( location.hash != null && location.hash === '#reset')
        return new Promise(function (resolve, reject) {
          self.stack.push({ class: 'foam.nanos.auth.resetPassword.ResetView' });
          self.loginSuccess$.sub(resolve);
        });

      return new Promise(function(resolve, reject) {
        self.stack.push({ class: 'foam.nanos.auth.SignInView' });
        self.loginSuccess$.sub(resolve);
      });
    }
  ],

  listeners: [
    function onUserUpdate() {
      this.setDefaultMenu();
    },

    // This listener should be triggered when a Menu item has been launched AND
    // navigates to a new screen.
    function menuListener(m) {
      this.currentMenu = m;
    },

    // This listener should be triggered when a Menu has been launched but does
    // not navigate to a new screen. Typically for SubMenus
    function lastMenuLaunchedListener(m) {
      this.lastMenuLaunched = m;
    }
  ]
});
