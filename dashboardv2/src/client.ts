import { grpc } from '@improbable-eng/grpc-web';

import Config from './config';
import { ControllerClient, ServiceError, Status, ResponseStream } from './generated/controller_pb_service';
import {
	ListAppsRequest,
	ListAppsResponse,
	GetAppRequest,
	UpdateAppRequest,
	App,
	GetAppReleaseRequest,
	GetReleaseRequest,
	CreateReleaseRequest,
	ListReleasesRequest,
	ListReleasesResponse,
	Release,
	ReleaseType,
	GetAppFormationRequest,
	Formation,
	ScaleRequest,
	ListScaleRequestsRequest,
	ListScaleRequestsResponse,
	CreateScaleRequest,
	CreateDeploymentRequest,
	Deployment,
	Event
} from './generated/controller_pb';

import protoMapReplace from './util/protoMapReplace';

export interface Client {
	listAppsStream: (cb: ListAppsStreamCallback) => () => void;
	getApp: (name: string) => Promise<App>;
	streamApp: (name: string, cb: StreamAppCallback) => () => void;
	updateApp: (app: App) => Promise<App>;
	updateAppMeta: (app: App) => Promise<App>;
	streamAppRelease: (appName: string, cb: StreamAppReleaseCallback) => () => void;
	streamAppFormation: (appName: string, cb: StreamAppFormationCallback) => () => void;
	createScale: (req: CreateScaleRequest) => Promise<ScaleRequest>;
	listScaleRequestsStream: (appName: string, cb: ListScaleRequestsStreamCallback) => () => void;
	getRelease: (name: string) => Promise<Release>;
	listReleasesStream: (
		parentName: string,
		cb: ListReleasesStreamCallback,
		...reqModifiers: ListReleasesRequestModifier[]
	) => () => void;
	createRelease: (parentName: string, release: Release) => Promise<Release>;
	createDeployment: (parentName: string, releaseName: string) => Promise<Deployment>;
	createDeploymentWithFormation: (parentName: string, releaseName: string, f: Formation) => Promise<Deployment>;
}

export type StreamEventsCallback = (event: Event | null, error: Error | null) => void;
export type ListAppsStreamCallback = (apps: App[], error: Error | null) => void;
export type StreamAppCallback = (app: App, error: Error | null) => void;
export type StreamAppReleaseCallback = (release: Release, error: Error | null) => void;
export type StreamAppFormationCallback = (formation: Formation, error: Error | null) => void;
export type ListReleasesStreamCallback = (releases: Release[], error: Error | null) => void;
export type ListScaleRequestsStreamCallback = (scaleRequests: ScaleRequest[], error: Error | null) => void;

export type ListReleasesRequestModifier = (req: ListReleasesRequest) => void;

export function listReleasesRequestFilterLabels(filterLabels: { [key: string]: string }): ListReleasesRequestModifier {
	return (req: ListReleasesRequest) => {
		const fl = req.getFilterLabelsMap();
		for (const [k, v] of Object.entries(filterLabels)) {
			fl.set(k, v);
		}
	};
}

export function listReleasesRequestFilterType(filterType: ReleaseType): ListReleasesRequestModifier {
	return (req: ListReleasesRequest) => {
		req.setFilterType(filterType);
	};
}

export interface StreamEventsOptions {}

interface Cancellable {
	cancel(): void;
}

function buildCancelFunc(stream: Cancellable): () => void {
	let cancelled = false;
	return () => {
		if (cancelled) return;
		cancelled = true;
		stream.cancel();
	};
}

const __memoizedStreams = {} as { [key: string]: ResponseStream<any> };
const __memoizedStreamUsers = {} as { [key: string]: number };
const __memoizedStreamResponses = {} as { [key: string]: any };
function memoizedStream<T>(
	contextKey: string,
	streamKey: string,
	initStream: () => ResponseStream<T>
): [ResponseStream<T>, T | undefined] {
	const key = contextKey + streamKey;
	function cleanup() {
		const n = (__memoizedStreamUsers[key] = (__memoizedStreamUsers[key] || 0) - 1);
		if (n === 0) {
			delete __memoizedStreams[key];
			delete __memoizedStreamUsers[key];
			delete __memoizedStreamResponses[key];
		}
		return n;
	}

	__memoizedStreamUsers[key] = (__memoizedStreamUsers[key] || 0) + 1;

	let stream = __memoizedStreams[key];
	if (stream) {
		return [stream as ResponseStream<T>, __memoizedStreamResponses[key] as T | undefined];
	}
	stream = initStream();
	stream.on('data', (data: T) => {
		__memoizedStreamResponses[key] = data;
	});
	stream.on('end', cleanup);
	const cancel = stream.cancel;
	stream.cancel = () => {
		if (cleanup() === 0) {
			cancel();
		}
	};
	__memoizedStreams[key] = stream;
	return [stream, undefined];
}

class _Client implements Client {
	private _cc: ControllerClient;
	constructor(cc: ControllerClient) {
		this._cc = cc;
	}

	public listAppsStream(cb: ListAppsStreamCallback): () => void {
		const stream = this._cc.listAppsStream();
		stream.write(new ListAppsRequest());
		stream.on('data', (response: ListAppsResponse) => {
			cb(response.getAppsList(), null);
		});
		// TODO(jvatic): Handle stream error
		return buildCancelFunc(stream);
	}

	public getApp(name: string): Promise<App> {
		const getAppRequest = new GetAppRequest();
		getAppRequest.setName(name);
		return new Promise<App>((resolve, reject) => {
			this._cc.getApp(getAppRequest, (error: ServiceError, response: App | null) => {
				if (response && error === null) {
					resolve(response);
				} else {
					reject(error);
				}
			});
		});
	}

	public streamApp(name: string, cb: StreamAppCallback): () => void {
		const [stream, lastResponse] = memoizedStream('streamApp', name, () => {
			const getAppRequest = new GetAppRequest();
			getAppRequest.setName(name);
			const stream = this._cc.streamApp(getAppRequest);
			return stream;
		});
		stream.on('data', (response: App) => {
			cb(response, null);
		});
		if (lastResponse) {
			cb(lastResponse, null);
		}
		// TODO(jvatic): Handle stream error
		return buildCancelFunc(stream);
	}

	public updateApp(app: App): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			const req = new UpdateAppRequest();
			req.setApp(app);
			this._cc.updateApp(req, (error: ServiceError, response: App | null) => {
				if (response && error === null) {
					resolve(response);
				} else {
					reject(error);
				}
			});
		});
	}

	public updateAppMeta(app: App): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			const req = new UpdateAppRequest();
			req.setApp(app);
			this._cc.updateAppMeta(req, (error: ServiceError, response: App | null) => {
				if (response && error === null) {
					resolve(response);
				} else {
					reject(error);
				}
			});
		});
	}

	public streamAppRelease(appName: string, cb: StreamAppReleaseCallback): () => void {
		const req = new GetAppReleaseRequest();
		req.setParent(appName);
		const stream = this._cc.streamAppRelease(req);
		stream.on('data', (response: Release) => {
			cb(response, null);
		});
		// TODO(jvatic): Handle stream error
		return buildCancelFunc(stream);
	}

	public streamAppFormation(appName: string, cb: StreamAppFormationCallback): () => void {
		const [stream, lastResponse] = memoizedStream('streamAppFormation', appName, () => {
			const req = new GetAppFormationRequest();
			req.setParent(appName);
			return this._cc.streamAppFormation(req);
		});
		stream.on('data', (response: Formation) => {
			cb(response, null);
		});
		if (lastResponse) {
			cb(lastResponse, null);
		}
		// TODO(jvatic): Handle stream error
		return buildCancelFunc(stream);
	}

	public createScale(req: CreateScaleRequest): Promise<ScaleRequest> {
		return new Promise<ScaleRequest>((resolve, reject) => {
			this._cc.createScale(req, (error: ServiceError, response: ScaleRequest | null) => {
				if (response && error === null) {
					resolve(response);
				} else {
					reject(error);
				}
			});
		});
	}

	public listScaleRequestsStream(appName: string, cb: ListScaleRequestsStreamCallback): () => void {
		const req = new ListScaleRequestsRequest();
		req.setParent(appName);
		const stream = this._cc.listScaleRequestsStream(req);
		stream.on('data', (response: ListScaleRequestsResponse) => {
			cb(response.getScaleRequestsList(), null);
		});
		// TODO(jvatic): Handle stream error
		return buildCancelFunc(stream);
	}

	public getRelease(name: string): Promise<Release> {
		const getReleaseRequest = new GetReleaseRequest();
		getReleaseRequest.setName(name);
		return new Promise<Release>((resolve, reject) => {
			this._cc.getRelease(getReleaseRequest, (error: ServiceError, response: Release | null) => {
				if (response && error === null) {
					resolve(response);
				} else {
					reject(error);
				}
			});
		});
	}

	public listReleasesStream(
		parentName: string,
		cb: ListReleasesStreamCallback,
		...reqModifiers: ListReleasesRequestModifier[]
	): () => void {
		const stream = this._cc.listReleasesStream();
		const req = new ListReleasesRequest();
		req.setParent(parentName);
		reqModifiers.forEach((m) => m(req));
		stream.write(req);
		stream.on('data', (response: ListReleasesResponse) => {
			cb(response.getReleasesList(), null);
		});
		// TODO(jvatic): Handle stream error
		return buildCancelFunc(stream);
	}

	public createRelease(parentName: string, release: Release): Promise<Release> {
		const req = new CreateReleaseRequest();
		req.setParent(parentName);
		req.setRelease(release);
		return new Promise<Release>((resolve, reject) => {
			this._cc.createRelease(req, (error: ServiceError, response: Release | null) => {
				if (response && error === null) {
					resolve(response);
				} else {
					reject(error);
				}
			});
		});
	}

	public createDeployment(parentName: string, releaseName: string): Promise<Deployment> {
		const req = new CreateDeploymentRequest();
		req.setParent(parentName);
		req.setRelease(releaseName);
		req.setUsePrevFormation(true);
		let deployment = null as Deployment | null;
		return new Promise<Deployment>((resolve, reject) => {
			const stream = this._cc.createDeployment(req);
			stream.on('data', (event: Event) => {
				if (event.hasDeploymentEvent()) {
					const de = event.getDeploymentEvent();
					const d = de && de.getDeployment();
					if (d) {
						deployment = d;
					}
				}
			});
			stream.on('status', (s: Status) => {
				console.log('status', s);
				if (s.code === grpc.Code.OK && deployment) {
					resolve(deployment);
				} else {
					reject(new Error(s.details));
				}
			});
			stream.on('end', () => {});
		});
	}

	public createDeploymentWithFormation(parentName: string, releaseName: string, f: Formation): Promise<Deployment> {
		const req = new CreateDeploymentRequest();
		req.setParent(parentName);
		req.setRelease(releaseName);
		req.setUsePrevFormation(false);
		protoMapReplace(req.getProcessesMap(), f.getProcessesMap());
		protoMapReplace(req.getTagsMap(), f.getTagsMap());
		console.log(req.toObject());
		let deployment = null as Deployment | null;
		return new Promise<Deployment>((resolve, reject) => {
			const stream = this._cc.createDeployment(req);
			stream.on('data', (event: Event) => {
				if (event.hasDeploymentEvent()) {
					const de = event.getDeploymentEvent();
					const d = de && de.getDeployment();
					if (d) {
						deployment = d;
					}
				}
			});
			stream.on('status', (s: Status) => {
				console.log('status', s);
				if (s.code === grpc.Code.OK && deployment) {
					resolve(deployment);
				} else {
					reject(new Error(s.details));
				}
			});
			stream.on('end', () => {});
		});
	}
}

const cc = new ControllerClient(Config.CONTROLLER_HOST, {});

export default new _Client(cc);
