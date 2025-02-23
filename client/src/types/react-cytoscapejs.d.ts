declare module 'react-cytoscapejs' {
  import { Component } from 'react';
  import { Core, ElementDefinition, LayoutOptions, Stylesheet } from 'cytoscape';

  interface CytoscapeComponentProps {
    elements: ElementDefinition[];
    stylesheet: Stylesheet[];
    layout?: LayoutOptions;
    style?: React.CSSProperties;
    cy?: (cy: Core) => void;
    className?: string;
  }

  class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
  export default CytoscapeComponent;
}
