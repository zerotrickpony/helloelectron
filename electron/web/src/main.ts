import $ from 'jquery';
import { App } from './app';

$(document).ready(() => {
  const w = window as any;
  w['pfapp'] = new App();
  w['pfapp'].run();
});
