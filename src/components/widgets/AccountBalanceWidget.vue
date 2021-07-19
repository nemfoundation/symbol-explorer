<template>
	<Card :loading="loading">
		<template #title>{{getNameByKey(title)}}</template>

		<template #body>
			<div class="body-wrapper">
				<div class="body">
					<div class="section">
						<svg
							class="account-icon"
							viewBox="15 15 115 115"
							:width="55"
							:height="55"
						>
							<AccountIcon
								:width="128"
								:height="128"
								:address="address"
								hideCaption
							/>
						</svg>
						<div>
							<img :src="ConnectorIcon" class="icon noselect" />
							<div class="address">
								<div>
									{{address}}
									<img
										:src="IconCopy"
										class="icon-copy noselect"
										@click="onCopyClick" />
								</div>
								<div>{{alias}}</div>
							</div>
						</div>
					</div>
					<div class="mosaic">{{mosaicName}}</div>
					<Decimal class="balance" :value="balance" />
				</div>
			</div>
		</template>
	</Card>
</template>

<script>
import Card from '@/components/containers/Card.vue';
import Decimal from '@/components/fields/Decimal.vue';
import AccountIcon from '../graphics/AccountIcon.vue';
import ConnectorIcon from '../../styles/img/connector_bg_1.png';
import helper from '../../helper';
import Constants from '../../config/constants';
import IconCopy from '../../styles/img/copy.png';

export default {
	props: {
		managerGetter: String,
		dataGetter: String,
		title: {
			type: String,
			default: 'accountBalanceTitle'
		}
	},

	components: {
		Card,
		AccountIcon,
		Decimal
	},

	data() {
		return {
			ConnectorIcon,
			IconCopy
		};
	},

	computed: {
		data() {
			return this.dataGetter
				? this.$store.getters[this.dataGetter]
				: this.$store.getters[this.managerGetter].data;
		},

		balance() {
			return this.data.mosaic?.amount || '0';
		},

		address() {
			return this.data.address;
		},

		alias() {
			return Constants.Message.UNAVAILABLE !== this.data.alias[0]
				? this.data.alias[0]
				: this.getNameByKey('noAlias');
		},

		mosaicName() {
			const mosaicAlias = this.data.mosaic?.mosaicAliasNames[0];

			if (mosaicAlias) {
				const mosaicNamespaces = mosaicAlias.split('.');
				const mosaicLastSubnamespace = mosaicNamespaces.pop();

				return mosaicLastSubnamespace;
			}

			return this.data.mosaic?.mosaicId || 'Network Currency';
		},

		loading() {
			return this.$store.getters[this.managerGetter].loading;
		},

		error() {
			return this.$store.getters[this.managerGetter].error;
		}
	},

	methods: {
		getNameByKey(e) {
			return this.$store.getters['ui/getNameByKey'](e);
		},

		onCopyClick() {
			helper.copyTextToClipboard(this.address)
				.then(() => this.successMsg())
				.catch(() => this.errorMsg());
		},

		successMsg() {
			this.$bvToast.toast(this.getNameByKey('addressBeenCopied'), {
				variant: 'success',
				solid: true,
				'noCloseButton': true
			});
		},

		errorMsg() {
			this.$bvToast.toast(this.getNameByKey('failedToCopy'), {
				variant: 'danger',
				solid: true,
				'noCloseButton': true
			});
		}
	}
};
</script>

<style lang="scss" scoped>
.icon-copy {
    margin-top: -2px;
    margin-left: 5px;
    opacity: 0.5;
    cursor: pointer;
}

.body-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;

    .body {
        background: linear-gradient(120deg, var(--primary) 0%, var(--secondary) 100%);
        color: #fff;
        border-radius: 5px;
        position: relative;
        display: inline-block;
        padding: 40px;

        .section {
            display: flex;
            flex-direction: row;
            justify-content: space-between;

            .account-icon {
                margin-right: 20px;
                background: #fff;
                border-radius: 20px;
                padding: 10px;
            }

            .address {
                font-size: 1rem;
                line-height: 1.75rem;
                margin: 0 0 33.2px;
                max-width: 100%;
            }

            .icon {
                position: absolute;
                bottom: 0;
                right: 0;
                height: 100%;
                pointer-events: none;
            }
        }

        .mosaic {
            font-size: 1.5rem;
            line-height: 2.25rem;
			text-transform: uppercase;
        }

        .balance {
            font-size: 2.5rem;
            line-height: 3.25rem;
        }
    }
}
</style>
