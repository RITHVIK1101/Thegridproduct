declare module 'react-native-vector-icons/Ionicons' {
    import { IconProps } from 'react-native-vector-icons/Icon';
    import React from 'react';
    import { TextStyle, ViewStyle, StyleProp } from 'react-native';
  
    export interface IoniconProps extends IconProps {
      style?: StyleProp<TextStyle | ViewStyle>;
    }
  
    const Ionicons: React.FC<IoniconProps>;
    export default Ionicons;
  }
  