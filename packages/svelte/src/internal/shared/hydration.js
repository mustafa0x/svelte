import { HYDRATION_START_FAILED } from '../../constants.js';

/**
 * Creates the hydration comment payload that marks the start of a failed boundary.
 * The error is JSON-serialized and escaped to prevent `-->` or `<!--` sequences
 * from breaking out of the comment.
 * @param {unknown} error
 * @returns {string}
 */
export function serialize_failed_boundary(error) {
	var json = JSON.stringify(error);
	var escaped = (json ?? 'null').replace(/>/g, '\\u003e').replace(/</g, '\\u003c');
	return HYDRATION_START_FAILED + escaped;
}
