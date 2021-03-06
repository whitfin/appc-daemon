# v1.4.0 (Mar 29, 2019)

 * Fixed bug where streamed objects were not being stringified in the middleware callback.
   [(DAEMON-271)](https://jira.appcelerator.org/browse/DAEMON-271)
 * Added check to ensure `ServiceDispatcher` is not directly instantiable.
 * Fixed bug when dispatch handler is a `Dispatcher` or `ServiceDispatcher` and the route path is
   `/` route causing the leading `/` to get stripped off and not match the descending dispatcher's
   routes.
 * When a route `path` is a regex, sets the request params to the match result instead of setting
   each param's key name to the capture group index.
 * When registering a dispatcher route and the `path` is a regex, the second argument can be an
   array of key names used to name the capture groups.
 * Updated dependencies.

# v1.3.0 (Jan 24, 2019)

 * Upgraded to appcd-logger@2.0.0.

# v1.2.2 (Jan 16, 2019)

 * Added pluralize dependency since it was removed from snooplogg 2.
 * Refactored promises to async/await.
 * Updated dependencies.

# v1.2.1 (Nov 27, 2018)

 * Updated dependencies.

# v1.2.0 (Sep 17, 2018)

 * Removed support for period delimited filters in `DataServiceDispatcher`.
 * Added `startTime`, `status`, and `time` to `DispatcherContext`.
 * Cleaned up Koa middleware callback and added a `onRequest` callback for telemetry.
 * Fixed bug where `Dispatcher.call()` throws an error instead of returning a rejected promise.
 * Updated dependencies.

# v1.1.1 (May 24, 2018)

 * Updated dependencies:
   - appcd-gulp 1.1.1 -> 1.1.5
   - appcd-logger 1.1.0 -> 1.1.1
   - appcd-response 1.1.0 -> 1.1.2
   - path-to-regexp 2.2.0 -> 2.2.1
   - source-map-support 0.5.4 -> 0.5.6

# v1.1.0 (Apr 9, 2018)

 * Fixed incorrect path reference in dispatcher preventing the request from being rerouted
   correctly.
 * Fixed route invoker to always return a `DispatcherContext`. If the handler returns a value,
   it will store the value in the original context's response.
 * Improved readme.
 * Updated dependencies:
   - appcd-gulp 1.0.1 -> 1.1.1
   - appcd-logger 1.0.1 -> 1.1.0
   - appcd-response 1.0.1 -> 1.1.0
   - gawk 4.4.4 -> 4.4.5
   - path-to-regexp 2.1.0 -> 2.2.0
   - source-map-support 0.5.0 -> 0.5.4
   - uuid 3.1.0 -> 3.2.1

# v1.0.1 (Dec 15, 2017)

 * Updated dependencies:
   - appcd-gulp 1.0.0 -> 1.0.1
   - appcd-logger 1.0.0 -> 1.0.1
   - appcd-response 1.0.0 -> 1.0.1

# v1.0.0 (Dec 5, 2017)

 - Initial release.
