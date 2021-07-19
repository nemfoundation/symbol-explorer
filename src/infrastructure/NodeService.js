/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
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
 *
 */

import http from './http';
import Constants from '../config/constants';
import * as symbol from 'symbol-sdk';
import Axios from 'axios';
import moment from 'moment';
import helper from '../helper';
import globalConfig from '../config/globalConfig';

class NodeService {
    /**
     * Get Storage Info from symbol SDK
     * @returns StorageInfo
     */
    static getStorageInfo = () => {
    	return http.createRepositoryFactory.createNodeRepository()
    		.getStorageInfo()
    		.toPromise();
    }

    /**
     * Get Node Info from symbol SDK
     * @returns NodeInfo
     */
    static getCurrentNodeInfo = () => {
    	return http.createRepositoryFactory.createNodeRepository()
    		.getNodeInfo()
    		.toPromise();
    }

    /**
     * Get Server Info from symbol SDK
     * @returns ServerInfo
     */
    static getServerInfo = () => {
    	return http.node.getServerInfo().toPromise();
    }

    /**
     * Get Node Peers from symbol SDK
     * @returns NodeInfo[]
     */
    static getNodePeers = async () => {
    	let nodePeers = [];

    	try {
    		if (globalConfig.endpoints.statisticsService && globalConfig.endpoints.statisticsService.length)
    			nodePeers = (await Axios.get(globalConfig.endpoints.statisticsService + '/nodes')).data;
    		else
    			throw Error('Statistics service endpoint is not provided');
    	}
    	catch (e) {
    		nodePeers = await http.createRepositoryFactory.createNodeRepository()
    			.getNodePeers()
    			.toPromise();
    	}

    	const formattedNodePeers = nodePeers.map(nodeInfo => this.formatNodeInfo(nodeInfo)).sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

    	return formattedNodePeers;
    }

    /**
     * Get node health status by endpoint.
     * @param string api-node endpoint such as http:localhost:3000
     * @returns boolean
     */
    static isNodeActive = async (currentUrl) => {
    	let status = true;

    	try {
    		await new symbol.NodeHttp(currentUrl).getNodeHealth()
    			.toPromise();
    	}
    	catch (e) {
    		status = false;
    	}

    	return status;
    }

    /**
     * Format NodoInfoDTO to readable NodoInfo object
     * @param NodoInfoDTO
     * @returns Object readable NodeInfo object
     */
    static formatNodeInfo = nodeInfo => ({
    	...nodeInfo,
    	nodePublicKey: nodeInfo.publicKey,
    	address: symbol.Address.createFromPublicKey(nodeInfo.publicKey, nodeInfo.networkIdentifier).plain(),
    	rolesRaw: nodeInfo.roles,
    	roles: Constants.RoleType[nodeInfo.roles],
    	network: Constants.NetworkType[nodeInfo.networkIdentifier],
    	version: helper.formatNodeVersion(nodeInfo.version),
    	apiEndpoint:
            nodeInfo.roles === 2 ||
            nodeInfo.roles === 3 ||
            nodeInfo.roles === 6 ||
            nodeInfo.roles === 7
            	? 'http://' + nodeInfo.host + ':' + (globalConfig.apiNodePort || 3000)
            	: Constants.Message.UNAVAILABLE
    })

    /**
     * Format Node Peers dataset into Vue Component
     * @returns Node peers object for Vue component
     */
    static getNodePeerList = async (filter) => {
    	let nodePeers = await this.getNodePeers();

    	return {
    		data:
                nodePeers
                	.filter(el => !filter.rolesRaw || el.rolesRaw === filter.rolesRaw)
                	.filter(
                		el => !filter.rewardProgram ||
						(el.rewardPrograms?.length && filter.rewardProgram === 'all') ||
						(el.rewardPrograms && el.rewardPrograms[0]?.name === filter.rewardProgram)
                	)
                	.map((el, index) => {
                		let node = {
                			index: index + 1,
                			...el
                		};

                		node['softwareVersion'] = { version: el.version };

                		if (el.apiStatus) {
                			node['chainInfo'] = {
                				chainHeight: el.apiStatus.chainHeight,
                				finalizationHeight: el.apiStatus.finalizationHeight,
                				lastStatusCheck: el.apiStatus.lastStatusCheck
                			};

                			node['softwareVersion'] = {
                				...node.softwareVersion,
                				restVersion: el.apiStatus.restVersion
                			};
                		}
                		else
                			node['chainInfo'] = {};

                		if (node.hostDetail) {
                			node = { ...node, ...node.hostDetail };
                			delete node.hostDetail;
                		}

                		return node;
                	})
    	};
    }

	static getNodeStats = async () => {
		if (globalConfig.endpoints.statisticsService && globalConfig.endpoints.statisticsService.length)
			return (await Axios.get(globalConfig.endpoints.statisticsService + '/nodestats/')).data;
		else
			throw Error('Statistics service endpoint is not provided');
	}

    static getNodeInfo = async (publicKey) => {
    	let node = {};

    	try {
    		if (globalConfig.endpoints.statisticsService && globalConfig.endpoints.statisticsService.length)
    			node = (await Axios.get(globalConfig.endpoints.statisticsService + '/nodes/' + publicKey)).data;
    		else
    			throw Error('Statistics service endpoint is not provided');
    	}
    	catch (e) {
    		const nodes = (await Axios.get(http.nodeUrl + '/node/peers')).data;

    		node = nodes.find(n => n.publicKey === publicKey);
    	}
    	const formattedNode = this.formatNodeInfo(node);

    	if (formattedNode.rolesRaw === 2 ||
            formattedNode.rolesRaw === 3 ||
            formattedNode.rolesRaw === 6 ||
            formattedNode.rolesRaw === 7
    	) {
    		const status = await this.getApiNodeStatus(formattedNode.apiEndpoint);

    		formattedNode.apiStatus = status;

    		const chainInfo = await this.getNodeChainInfo(formattedNode.apiEndpoint);

    		formattedNode.chainInfo = chainInfo;
    	}
    	if (formattedNode?.peerStatus)
    		formattedNode.peerStatus.lastStatusCheck = moment(formattedNode.peerStatus.lastStatusCheck).format('YYYY-MM-DD HH:mm:ss');
    	return formattedNode;
    }

    static getApiNodeStatus = async (nodeUrl) => {
    	const status = {
    		connectionStatus: false,
    		databaseStatus: Constants.Message.UNAVAILABLE,
    		apiNodeStatus: Constants.Message.UNAVAILABLE,
    		lastStatusCheck: moment().format('YYYY-MM-DD HH:mm:ss')
    	};

    	try {
    		const nodeStatus = (await Axios.get(nodeUrl + '/node/health')).data.status;

    		status.connectionStatus = true;
    		status.apiNodeStatus = nodeStatus.apiNode === 'up';
    		status.databaseStatus = nodeStatus.db === 'up';
    		status.lastStatusCheck = moment().format('YYYY-MM-DD HH:mm:ss');
    	}
    	catch (e) {
    		console.error('Failed to get node status', e);
    	};

    	return status;
    }

    static getNodeChainInfo = async (nodeUrl) => {
    	let chainInfo = {};

    	try {
    		chainInfo = {};
    		const nodeChainInfo = (await Axios.get(nodeUrl + '/chain/info')).data;

    		chainInfo.height = nodeChainInfo.height;
    		chainInfo.scoreHigh = nodeChainInfo.scoreHigh;
    		chainInfo.scoreLow = nodeChainInfo.scoreLow;
    		chainInfo.finalizationEpoch = nodeChainInfo.latestFinalizedBlock.finalizationEpoch;
    		chainInfo.finalizationPoint = nodeChainInfo.latestFinalizedBlock.finalizationPoint;
    		chainInfo.finalizedHeight = nodeChainInfo.latestFinalizedBlock.height;
    		chainInfo.finalizedHash = nodeChainInfo.latestFinalizedBlock.hash;
    	}
    	catch (e) {
    		console.error('Failed to get node chain info', e);
    	};

    	return chainInfo;
    }

	static getNodeRewardsInfo = async (publicKey) => {
		const endpoint = globalConfig.endpoints.nodeRewardsController;

		if (endpoint && endpoint.length) {
			const nodeInfo = (await Axios.get(`${endpoint}/nodes/mainPublicKey/${publicKey}`)).data;

			if (!nodeInfo)
				throw Error(`Node doesn't take part in any rewards program`);

			const nodeId = nodeInfo.id;
			const testResults = (await Axios.get(`${endpoint}/testResults/nodeId/${nodeId}`)).data;

			let testResultInfo;

			if (testResults.length) {
				const latestRound = testResults[0].round;

				testResultInfo = (await Axios.get(`${endpoint}/testResultInfo/nodeId/${nodeId}/round/${latestRound}`)).data;
			}

			const nodeRewardsInfo = {
				nodeInfo,
				testResults,
				testResultInfo
			};

			return nodeRewardsInfo;
		}
		else
			throw Error('nodeRewardsController endpoint is not provided');
	}

	static getNodeStats = async () => {
		if (globalConfig.endpoints.statisticsService && globalConfig.endpoints.statisticsService.length)
			return (await Axios.get(globalConfig.endpoints.statisticsService + '/nodeStats')).data;
		else
			throw Error('Statistics service endpoint is not provided');
	}

	static getNodeHeightStats = async () => {
		if (globalConfig.endpoints.statisticsService && globalConfig.endpoints.statisticsService.length) {
			const data = (await Axios.get(globalConfig.endpoints.statisticsService + '/nodeHeightStats')).data;

			return [
				{
					name: 'Height',
					data: data.height.map(el => ({ x: '' + parseInt(el.value), y: parseInt(el.count) }))
				},
				{
					name: 'Finalized Height',
					data: data.finalizedHeight.map(el => ({ x: '' + parseInt(el.value), y: parseInt(el.count) }))
				}
			];
		}
		else
			throw Error('Statistics service endpoint is not provided');
	}

	static getNodePayouts = async (pageInfo, nodeId, filter, rewardProgram) => {
		const endpoint = globalConfig.endpoints.nodeRewardsController;

		if (endpoint && endpoint.length) {
			const params = { pageNumber: pageInfo.pageNumber, nodeId };

			let route = '/payouts';

			switch (rewardProgram) {
			case 'EarlyAdoption':
				route = '/payouts/earlyadoption';
				break;
			case 'Ecosystem':
				route = '/payouts/ecosystem';
				break;
			case 'SuperNode':
			default:
				route = filter === 'voting' ? '/votingPayouts' : '/payouts';
				break;
			}

			let isLastPage = true;

			const payoutsPage = (
				await Axios.get(endpoint + route, { params })
			).data;

			try {
				isLastPage = !(
					await Axios.get(endpoint + route, { params })
				).data.data.length;
			}
			catch (e) {}

			return {
				data: payoutsPage.data,
				...payoutsPage.pagination,
				isLastPage
			};
		}
		else
			throw Error('nodeRewardsController endpoint is not provided');
	}

	static getEnrollmentList = async (pageInfo, filterVaule, signerPublicKey) => {
		const endpoint = globalConfig.endpoints.nodeRewardsController;
		const { pageNumber, pageSize } = pageInfo;
		const searchCriteria = {
			pageNumber,
			pageSize,
			order: symbol.Order.Desc,
			...filterVaule
		};

		let url = `${endpoint}/enrollments`;

		if (signerPublicKey)
			url += `/signerPublicKey/${signerPublicKey}`;

		const response = (await Axios.get(url, { params: searchCriteria })).data;

		const data = {
			...response,
			...response.pagination,
			isLastPage: response.data.length < pageSize
		};

		data.data = data.data.map(el => ({
			...el,
			enrollmentId: el.id,
			agentUrl: el.agentUrl || Constants.Message.UNAVAILABLE
		}));

		return data;
	}

	static getEnrollmentInfo = async (id) => {
		const endpoint = globalConfig.endpoints.nodeRewardsController;
		const response = (await Axios.get(`${endpoint}/enrollments/${id}`)).data;

		return response;
	}

	static getNodeListCSV = async (filter) => {
		const nodes = await this.getNodePeerList(filter);

		const formattedData = nodes.data.map(node => ({
			no: node.index,
			host: node.host,
			country: node.country,
			friendlyName: node.friendlyName.replace(/,/g, '_'), // prevent friendly name break in CSV
			roles: node.roles,
			network: node.network,
			networkGenerationHashSeed: node.networkGenerationHashSeed,
			nodePublicKey: node.nodePublicKey,
			chainHeight: node.chainInfo.chainHeight,
			finalizationHeight: node.chainInfo.finalizationHeight,
			version: node.version,
			rewardPrograms: node.rewardPrograms.map(program => `${program.name}: ${program.passed ? 'Passed' : 'Fail'}`)
		}));

		return helper.convertArrayToCSV(formattedData);
	}
}

export default NodeService;
