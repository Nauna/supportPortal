/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
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

foam.CLASS({
  package: 'foam.dao',
  name: 'ManyToManyRelationshipDAO',
  extends: 'foam.dao.RelationshipDAO',

  implements: [ 'foam.mlang.Expressions' ],

  documentation: 'Adapts a DAO based on a *:* Relationship.',

  properties: [
    'junctionProperty',
    'joinDAOKey',
    'targetProperty',
    'junctionCls',
    {
      name: 'joinDAO',
      getter: function() {
        return this.__context__[this.joinDAOKey];
      }
    },
    {
      name: 'predicate',
      documentation: `ManyToMany filtered querys are always "backward" to
        match inverse-namd property and source object's id.`,
      getter: function() {
        return this.EQ(
          this.junctionCls[foam.String.constantize(this.relationship.inverseName)],
          this.obj.id);
      }
    }
  ],

  methods: [
    function put(obj) {
      var self = this;
      return self.__context__[foam.String.daoize(self.of.name)].put(obj)
          .then(function(obj) {
            return self.delegate.put(self.relationship.adaptTarget(self.obj, obj))
          })
    },
    function find(id) {
      return this.joinDAO.find(id);
    },
    function select(sink, skip, limit, order, predicate) {
      var self = this;

      return self.SUPER(self.MAP(self.junctionProperty)).then(function(map) {
        return self.joinDAO.select(sink, skip, limit, order, self.AND(
          predicate || self.TRUE,
          self.IN(self.targetProperty, map.delegate.a)));
      });
    }
  ]
});