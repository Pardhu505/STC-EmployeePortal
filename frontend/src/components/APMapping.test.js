import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import APMapping from './APMapping';

describe('APMapping', () => {
  test('renders the APMapping component', () => {
    render(
      <Router>
        <APMapping />
      </Router>
    );
    expect(screen.getByText('Andhra Pradesh Urban / Rural Administrative Mapping')).toBeInTheDocument();
    expect(screen.getByText('RLB')).toBeInTheDocument();
    expect(screen.getByText('ULB')).toBeInTheDocument();
  });
});
