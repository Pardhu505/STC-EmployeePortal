import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import Projects from './Projects';

describe('Projects', () => {
  test('renders the Projects component', () => {
    render(
      <Router>
        <Projects />
      </Router>
    );
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Andhra Pradesh Urban / Rural Administrative Mapping')).toBeInTheDocument();
    expect(screen.getByText('Campaign Dashboard')).toBeInTheDocument();
  });
});
