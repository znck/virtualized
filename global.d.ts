import Vue from 'vue'
import { ThisTypedComponentOptionsWithRecordProps } from 'vue/types/options'
import { ExtendedVue } from 'vue/types/vue'

declare module 'vue' {
  export interface VueConstructor<V extends Vue = Vue> {
    extend<Instance extends V, Data, Methods, Computed, Props>(
      options?: ThisTypedComponentOptionsWithRecordProps<
        Instance,
        Data,
        Methods,
        Computed,
        Props
      >
    ): ExtendedVue<V, Data, Methods, Computed, Props>
  }
}
