/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core;

import foam.lib.json.Outputter;
import java.security.*;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/** Abstract base class for all generated FOAM Objects. **/
public abstract class AbstractFObject
  extends    ContextAwareSupport
  implements FObject, Comparable, Appendable
{
  public static FObject maybeClone(FObject fo) {
    return ( fo == null ? null : fo.fclone() );
  }

  public FObject deepClone() {
    return fclone();
  }

  public FObject shallowClone() {
    try {
      FObject ret = getClass().newInstance();
      List<PropertyInfo> props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
      for ( PropertyInfo prop : props ) {
        if ( ! prop.isSet(this) ) continue;
        prop.set(ret, prop.get(this));
      }
      return ret;
    } catch (IllegalAccessException | InstantiationException e) {
      return null;
    }
  }

  public FObject fclone() {
    try {
      FObject ret = getClass().newInstance();
      List<PropertyInfo> props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
      for( PropertyInfo prop : props ) {
        if ( ! prop.isSet(this) ) continue;
        prop.cloneProperty(this, ret);
      }
      return ret;
    } catch (IllegalAccessException | InstantiationException e) {
      return null;
    }
  }

  public FObject copyFrom(FObject obj) {
    List<PropertyInfo> props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
    for ( PropertyInfo p : props ) p.set(this, p.get(obj));
    return this;
  }

  public Map diff(FObject obj) {
    List props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
    Iterator i = props.iterator();

    Map result = new HashMap();
    while ( i.hasNext() ) {
      PropertyInfo prop = (PropertyInfo) i.next();
      prop.diff(this, obj, result, prop);
    }

    return result;
  }

  public FObject hardDiff(FObject obj) {
    FObject ret = null;
    boolean isDiff = false;
    try {
      ret = (FObject) getClass().newInstance();
      List props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
      Iterator i = props.iterator();
      PropertyInfo prop = null;
      while ( i.hasNext() ) {
        prop = (PropertyInfo) i.next();
        if ( prop.hardDiff(this, obj, ret) ) {
          isDiff = true;
        }
      }
    } catch ( Throwable t ) {
      throw new RuntimeException(t);
    } finally {
      if ( isDiff ) return ret;
      return null;
    }
  }

  @Override
  public int compareTo(Object o) {
    if ( o == this ) return 0;
    if ( o == null ) return 1;
    if ( ! ( o instanceof FObject ) ) return 1;

    if ( getClass() != o.getClass() ) {
      return getClassInfo().getId().compareTo(((FObject)o).getClassInfo().getId());
    }

    List props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
    Iterator i = props.iterator();

    int result;
    while ( i.hasNext() ) {
      result = ((PropertyInfo) i.next()).compare(this, o);
      if ( result != 0 ) return result;
    }

    return 0;
  }

  @Override
  public boolean equals(Object o) {
    return compareTo(o) == 0;
  }

  public FObject setProperty(String prop, Object value) {
    PropertyInfo property = ((PropertyInfo) getClassInfo().getAxiomByName(prop));
    if ( property != null ) property.set(this, value);
    return this;
  }

  public Object getProperty(String prop) {
    PropertyInfo property = ((PropertyInfo) getClassInfo().getAxiomByName(prop));
    return property == null ? null : property.get(this);
  }

  public boolean isPropertySet(String prop) {
    PropertyInfo property = (PropertyInfo) getClassInfo().getAxiomByName(prop);
    return property != null && property.isSet(this);
  }

  public boolean hasDefaultValue(String prop) {
    if ( ! this.isPropertySet(prop) ) return true;
    PropertyInfo property = (PropertyInfo) getClassInfo().getAxiomByName(prop);
    return property != null && property.isDefaultValue(this);
  }

  public byte[] hash() throws NoSuchAlgorithmException {
    return this.hash(null);
  }

  public byte[] hash(byte[] hash) throws NoSuchAlgorithmException {
    return this.hash("SHA-256", hash);
  }

  public byte[] hash(String algorithm, byte[] hash) throws NoSuchAlgorithmException {
      MessageDigest md = MessageDigest.getInstance(algorithm);
      List props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
      Iterator i = props.iterator();

      while ( i.hasNext() ) {
        PropertyInfo prop = (PropertyInfo) i.next();
        if ( ! prop.includeInDigest() ) continue;
        if ( ! prop.isSet(this) ) continue;
        if ( prop.isDefaultValue(this) ) continue;
        md.update(prop.getNameAsByteArray());
        prop.updateDigest(this, md);
      }

      // no chaining so return digest
      if ( hash == null || hash.length == 0 ) {
        return md.digest();
      }

      // calculate digest, update with previous hash and current hash
      byte[] digest = md.digest();
      md.update(hash);
      md.update(digest);
      return md.digest();
  }

  public byte[] sign(PrivateKey key) throws NoSuchAlgorithmException, InvalidKeyException, SignatureException {
    return this.sign("SHA256withRSA", key);
  }

  public byte[] sign(String algorithm, PrivateKey key) throws NoSuchAlgorithmException, InvalidKeyException, SignatureException {
    Signature signer = Signature.getInstance(algorithm);
    signer.initSign(key, SecureRandom.getInstance("SHA1PRNG"));

    List props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
    Iterator i = props.iterator();
    while ( i.hasNext() ) {
      PropertyInfo prop = (PropertyInfo) i.next();
      if ( ! prop.includeInSignature() ) continue;
      if ( ! prop.isSet(this) ) continue;
      if ( prop.isDefaultValue(this) ) continue;
      signer.update(prop.getNameAsByteArray());
      prop.updateSignature(this, signer);
    }
    return signer.sign();
  }

  public boolean verify(byte[] signature, PublicKey key) throws NoSuchAlgorithmException, InvalidKeyException, SignatureException {
    return this.verify(signature, "SHA256withRSA", key);
  }

  public boolean verify(byte[] signature, String algorithm, PublicKey key) throws NoSuchAlgorithmException, InvalidKeyException, SignatureException {
    Signature verifier = Signature.getInstance(algorithm);
    verifier.initVerify(key);

    List props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
    Iterator i = props.iterator();
    while ( i.hasNext() ) {
      PropertyInfo prop = (PropertyInfo) i.next();
      if ( ! prop.includeInSignature() ) continue;
      if ( ! prop.isSet(this) ) continue;
      if ( prop.isDefaultValue(this) ) continue;
      verifier.update(prop.getNameAsByteArray());
      prop.updateSignature(this, verifier);
    }
    return verifier.verify(signature);
  }

  public String toString() {
    StringBuilder sb = new StringBuilder();
    append(sb);
    return sb.toString();
  }

  public void append(StringBuilder sb)  {
    List     props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
    Iterator i     = props.iterator();

    while ( i.hasNext() ) {
      PropertyInfo prop = (PropertyInfo) i.next();

      sb.append(prop.getName());
      sb.append(": ");

      try {
        Object value = prop.get(this);

        if ( value instanceof Appendable ) {
          ((Appendable) value).append(sb);
        } else {
          sb.append(value);
        }
      } catch (Throwable t) {
        sb.append("-");
      }

      if ( i.hasNext() ) sb.append(", ");
    }
  }

  public String toJSON() {
    Outputter out = new Outputter();
    return out.stringify(this);
  }

  protected boolean __frozen__ = false;

  protected void beforeFreeze() {}

  public void freeze() {
    beforeFreeze();
    __frozen__ = true;
  }

  public boolean isFrozen() {
    return __frozen__;
  }
}
