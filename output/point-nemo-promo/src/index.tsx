import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Promo} from './Promo';
const Root=()=> <Composition id="PointNemo" component={Promo} width={1920} height={1080} fps={30} durationInFrames={1800}/>;
registerRoot(Root);
