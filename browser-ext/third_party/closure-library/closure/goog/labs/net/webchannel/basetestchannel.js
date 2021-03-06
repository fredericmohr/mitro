// Copyright 2006 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Base TestChannel implementation.
 *
 */


goog.provide('goog.labs.net.webChannel.BaseTestChannel');

goog.require('goog.json.EvalJsonProcessor');
goog.require('goog.labs.net.webChannel.Channel');
goog.require('goog.labs.net.webChannel.ChannelRequest');
goog.require('goog.labs.net.webChannel.requestStats');
goog.require('goog.labs.net.webChannel.requestStats.Stat');



/**
 * A TestChannel is used during the first part of channel negotiation
 * with the server to create the channel. It helps us determine whether we're
 * behind a buffering proxy.
 *
 * @constructor
 * @struct
 * @param {!goog.labs.net.webChannel.Channel} channel The channel
 *     that owns this test channel.
 * @param {!goog.labs.net.webChannel.WebChannelDebug} channelDebug A
 *     WebChannelDebug instance to use for logging.
 * @implements {goog.labs.net.webChannel.Channel}
 */
goog.labs.net.webChannel.BaseTestChannel = function(channel, channelDebug) {
  /**
   * The channel that owns this test channel
   * @private {!goog.labs.net.webChannel.Channel}
   */
  this.channel_ = channel;

  /**
   * The channel debug to use for logging
   * @private {!goog.labs.net.webChannel.WebChannelDebug}
   */
  this.channelDebug_ = channelDebug;

  /**
   * Parser for a response payload. Defaults to use
   * {@code goog.json.unsafeParse}. The parser should return an array.
   * @private {goog.string.Parser}
   */
  this.parser_ = new goog.json.EvalJsonProcessor(null, true);
};


goog.scope(function() {
var BaseTestChannel = goog.labs.net.webChannel.BaseTestChannel;
var WebChannelDebug = goog.labs.net.webChannel.WebChannelDebug;
var ChannelRequest = goog.labs.net.webChannel.ChannelRequest;
var requestStats = goog.labs.net.webChannel.requestStats;
var Channel = goog.labs.net.webChannel.Channel;


/**
 * Extra HTTP headers to add to all the requests sent to the server.
 * @type {Object}
 * @private
 */
BaseTestChannel.prototype.extraHeaders_ = null;


/**
 * The test request.
 * @type {ChannelRequest}
 * @private
 */
BaseTestChannel.prototype.request_ = null;


/**
 * Whether we have received the first result as an intermediate result. This
 * helps us determine whether we're behind a buffering proxy.
 * @type {boolean}
 * @private
 */
BaseTestChannel.prototype.receivedIntermediateResult_ = false;


/**
 * The time when the test request was started. We use timing in IE as
 * a heuristic for whether we're behind a buffering proxy.
 * @type {?number}
 * @private
 */
BaseTestChannel.prototype.startTime_ = null;


/**
 * The time for of the first result part. We use timing in IE as a
 * heuristic for whether we're behind a buffering proxy.
 * @type {?number}
 * @private
 */
BaseTestChannel.prototype.firstTime_ = null;


/**
 * The time for of the last result part. We use timing in IE as a
 * heuristic for whether we're behind a buffering proxy.
 * @type {?number}
 * @private
 */
BaseTestChannel.prototype.lastTime_ = null;


/**
 * The relative path for test requests.
 * @type {?string}
 * @private
 */
BaseTestChannel.prototype.path_ = null;


/**
 * The state of the state machine for this object.
 *
 * @type {?number}
 * @private
 */
BaseTestChannel.prototype.state_ = null;


/**
 * The last status code received.
 * @type {number}
 * @private
 */
BaseTestChannel.prototype.lastStatusCode_ = -1;


/**
 * A subdomain prefix for using a subdomain in IE for the backchannel
 * requests.
 * @type {?string}
 * @private
 */
BaseTestChannel.prototype.hostPrefix_ = null;


/**
 * Enum type for the test channel state machine
 * @enum {number}
 * @private
 */
BaseTestChannel.State_ = {
  /**
   * The state for the TestChannel state machine where we making the
   * initial call to get the server configured parameters.
   */
  INIT: 0,

  /**
   * The  state for the TestChannel state machine where we're checking to
   * se if we're behind a buffering proxy.
   */
  CONNECTION_TESTING: 1
};


/**
 * Time between chunks in the test connection that indicates that we
 * are not behind a buffering proxy. This value should be less than or
 * equals to the time between chunks sent from the server.
 * @type {number}
 * @private
 */
BaseTestChannel.MIN_TIME_EXPECTED_BETWEEN_DATA_ = 500;


/**
 * Sets extra HTTP headers to add to all the requests sent to the server.
 *
 * @param {Object} extraHeaders The HTTP headers.
 */
BaseTestChannel.prototype.setExtraHeaders = function(extraHeaders) {
  this.extraHeaders_ = extraHeaders;
};


/**
 * Sets a new parser for the response payload. A custom parser may be set to
 * avoid using eval(), for example.
 * By default, the parser uses {@code goog.json.unsafeParse}.
 * @param {!goog.string.Parser} parser Parser.
 */
BaseTestChannel.prototype.setParser = function(parser) {
  this.parser_ = parser;
};


/**
 * Starts the test channel. This initiates connections to the server.
 *
 * @param {string} path The relative uri for the test connection.
 */
BaseTestChannel.prototype.connect = function(path) {
  this.path_ = path;
  var sendDataUri = this.channel_.getForwardChannelUri(this.path_);

  requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_ONE_START);
  this.startTime_ = goog.now();

  // If the channel already has the result of the handshake, then skip it.
  var handshakeResult = this.channel_.getConnectionState().handshakeResult;
  if (goog.isDefAndNotNull(handshakeResult)) {
    this.hostPrefix_ = this.channel_.correctHostPrefix(handshakeResult[0]);
    this.state_ = BaseTestChannel.State_.CONNECTION_TESTING;
    this.checkBufferingProxy_();
    return;
  }

  // the first request returns server specific parameters
  sendDataUri.setParameterValues('MODE', 'init');
  this.request_ = ChannelRequest.createChannelRequest(this, this.channelDebug_);
  this.request_.setExtraHeaders(this.extraHeaders_);
  this.request_.xmlHttpGet(sendDataUri, false /* decodeChunks */,
      null /* hostPrefix */, true /* opt_noClose */);
  this.state_ = BaseTestChannel.State_.INIT;
};


/**
 * Begins the second stage of the test channel where we test to see if we're
 * behind a buffering proxy. The server sends back a multi-chunked response
 * with the first chunk containing the content '1' and then two seconds later
 * sending the second chunk containing the content '2'. Depending on how we
 * receive the content, we can tell if we're behind a buffering proxy.
 * @private
 */
BaseTestChannel.prototype.checkBufferingProxy_ = function() {
  this.channelDebug_.debug('TestConnection: starting stage 2');

  // If the test result is already available, skip its execution.
  var bufferingProxyResult =
      this.channel_.getConnectionState().bufferingProxyResult;
  if (goog.isDefAndNotNull(bufferingProxyResult)) {
    this.channelDebug_.debug(
        'TestConnection: skipping stage 2, precomputed result is ' +
        bufferingProxyResult ? 'Buffered' : 'Unbuffered');
    requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_TWO_START);
    if (bufferingProxyResult) { // Buffered/Proxy connection
      requestStats.notifyStatEvent(requestStats.Stat.PROXY);
      this.channel_.testConnectionFinished(this, false);
    } else { // Unbuffered/NoProxy connection
      requestStats.notifyStatEvent(requestStats.Stat.NOPROXY);
      this.channel_.testConnectionFinished(this, true);
    }
    return; // Skip the test
  }
  this.request_ = ChannelRequest.createChannelRequest(this, this.channelDebug_);
  this.request_.setExtraHeaders(this.extraHeaders_);
  var recvDataUri = this.channel_.getBackChannelUri(this.hostPrefix_,
      /** @type {string} */ (this.path_));

  requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_TWO_START);
  if (!ChannelRequest.supportsXhrStreaming()) {
    recvDataUri.setParameterValues('TYPE', 'html');
    this.request_.tridentGet(recvDataUri, Boolean(this.hostPrefix_));
  } else {
    recvDataUri.setParameterValues('TYPE', 'xmlhttp');
    this.request_.xmlHttpGet(recvDataUri, false /** decodeChunks */,
        this.hostPrefix_, false /** opt_noClose */);
  }
};


/**
 * @override
 */
BaseTestChannel.prototype.createXhrIo = function(hostPrefix) {
  return this.channel_.createXhrIo(hostPrefix);
};


/**
 * Aborts the test channel.
 */
BaseTestChannel.prototype.abort = function() {
  if (this.request_) {
    this.request_.cancel();
    this.request_ = null;
  }
  this.lastStatusCode_ = -1;
};


/**
 * Returns whether the test channel is closed. The ChannelRequest object expects
 * this method to be implemented on its handler.
 *
 * @return {boolean} Whether the channel is closed.
 * @override
 */
BaseTestChannel.prototype.isClosed = function() {
  return false;
};


/**
 * Callback from ChannelRequest for when new data is received
 *
 * @param {ChannelRequest} req The request object.
 * @param {string} responseText The text of the response.
 * @override
 */
BaseTestChannel.prototype.onRequestData = function(req, responseText) {
  this.lastStatusCode_ = req.getLastStatusCode();
  if (this.state_ == BaseTestChannel.State_.INIT) {
    this.channelDebug_.debug('TestConnection: Got data for stage 1');
    if (!responseText) {
      this.channelDebug_.debug('TestConnection: Null responseText');
      // The server should always send text; something is wrong here
      this.channel_.testConnectionFailure(this, ChannelRequest.Error.BAD_DATA);
      return;
    }
    /** @preserveTry */
    try {
      var respArray = this.parser_.parse(responseText);
    } catch (e) {
      this.channelDebug_.dumpException(e);
      this.channel_.testConnectionFailure(this, ChannelRequest.Error.BAD_DATA);
      return;
    }
    this.hostPrefix_ = this.channel_.correctHostPrefix(respArray[0]);
  } else if (this.state_ == BaseTestChannel.State_.CONNECTION_TESTING) {
    if (this.receivedIntermediateResult_) {
      requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_TWO_DATA_TWO);
      this.lastTime_ = goog.now();
    } else {
      // '11111' is used instead of '1' to prevent a small amount of buffering
      // by Safari.
      if (responseText == '11111') {
        requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_TWO_DATA_ONE);
        this.receivedIntermediateResult_ = true;
        this.firstTime_ = goog.now();
        if (this.checkForEarlyNonBuffered_()) {
          // If early chunk detection is on, and we passed the tests,
          // assume HTTP_OK, cancel the test and turn on noproxy mode.
          this.lastStatusCode_ = 200;
          this.request_.cancel();
          this.channelDebug_.debug(
              'Test connection succeeded; using streaming connection');
          requestStats.notifyStatEvent(requestStats.Stat.NOPROXY);
          this.channel_.testConnectionFinished(this, true);
        }
      } else {
        requestStats.notifyStatEvent(
            requestStats.Stat.TEST_STAGE_TWO_DATA_BOTH);
        this.firstTime_ = this.lastTime_ = goog.now();
        this.receivedIntermediateResult_ = false;
      }
    }
  }
};


/**
 * Callback from ChannelRequest that indicates a request has completed.
 *
 * @param {ChannelRequest} req The request object.
 * @override
 */
BaseTestChannel.prototype.onRequestComplete = function(req) {
  this.lastStatusCode_ = this.request_.getLastStatusCode();
  if (!this.request_.getSuccess()) {
    this.channelDebug_.debug(
        'TestConnection: request failed, in state ' + this.state_);
    if (this.state_ == BaseTestChannel.State_.INIT) {
      requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_ONE_FAILED);
    } else if (this.state_ == BaseTestChannel.State_.CONNECTION_TESTING) {
      requestStats.notifyStatEvent(requestStats.Stat.TEST_STAGE_TWO_FAILED);
    }
    this.channel_.testConnectionFailure(this,
        /** @type {ChannelRequest.Error} */
        (this.request_.getLastError()));
    return;
  }

  if (this.state_ == BaseTestChannel.State_.INIT) {
    this.channelDebug_.debug(
        'TestConnection: request complete for initial check');
    this.state_ = BaseTestChannel.State_.CONNECTION_TESTING;
    this.checkBufferingProxy_();
  } else if (this.state_ == BaseTestChannel.State_.CONNECTION_TESTING) {
    this.channelDebug_.debug('TestConnection: request complete for stage 2');
    var goodConn = false;

    if (!ChannelRequest.supportsXhrStreaming()) {
      // we always get Trident responses in separate calls to
      // onRequestData, so we have to check the time they came
      var ms = this.lastTime_ - this.firstTime_;
      if (ms < 200) {
        // TODO: need to empirically verify that this number is OK
        // for slow computers
        goodConn = false;
      } else {
        goodConn = true;
      }
    } else {
      goodConn = this.receivedIntermediateResult_;
    }

    if (goodConn) {
      this.channelDebug_.debug(
          'Test connection succeeded; using streaming connection');
      requestStats.notifyStatEvent(requestStats.Stat.NOPROXY);
      this.channel_.testConnectionFinished(this, true);
    } else {
      this.channelDebug_.debug(
          'Test connection failed; not using streaming');
      requestStats.notifyStatEvent(requestStats.Stat.PROXY);
      this.channel_.testConnectionFinished(this, false);
    }
  }
};


/**
 * Returns the last status code received for a request.
 * @return {number} The last status code received for a request.
 */
BaseTestChannel.prototype.getLastStatusCode = function() {
  return this.lastStatusCode_;
};


/**
 * @return {boolean} Whether we should be using secondary domains when the
 *     server instructs us to do so.
 * @override
 */
BaseTestChannel.prototype.shouldUseSecondaryDomains = function() {
  return this.channel_.shouldUseSecondaryDomains();
};


/**
 * @override
 */
BaseTestChannel.prototype.isActive = function() {
  return this.channel_.isActive();
};


/**
 * @return {boolean} True if test stage 2 detected a non-buffered
 *     channel early and early no buffering detection is enabled.
 * @private
 */
BaseTestChannel.prototype.checkForEarlyNonBuffered_ = function() {
  var ms = this.firstTime_ - this.startTime_;

  // we always get Trident responses in separate calls to
  // onRequestData, so we have to check the time that the first came in
  // and verify that the data arrived before the second portion could
  // have been sent. For all other browser's we skip the timing test.
  return ChannelRequest.supportsXhrStreaming() ||
      ms < BaseTestChannel.MIN_TIME_EXPECTED_BETWEEN_DATA_;
};


/**
 * @override
 */
BaseTestChannel.prototype.getForwardChannelUri = goog.abstractMethod;


/**
 * @override
 */
BaseTestChannel.prototype.getBackChannelUri = goog.abstractMethod;


/**
 * @override
 */
BaseTestChannel.prototype.correctHostPrefix = goog.abstractMethod;


/**
 * @override
 */
BaseTestChannel.prototype.createDataUri = goog.abstractMethod;


/**
 * @override
 */
BaseTestChannel.prototype.testConnectionFinished = goog.abstractMethod;


/**
 * @override
 */
BaseTestChannel.prototype.testConnectionFailure = goog.abstractMethod;


/**
 * @override
 */
BaseTestChannel.prototype.getConnectionState = goog.abstractMethod;
});  // goog.scope
